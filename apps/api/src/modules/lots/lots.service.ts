import { Types } from "mongoose";
import sharp from "sharp";
import { fileTypeFromBuffer } from "file-type";
import type { CreateLotInput, SignedPhotoUrlResponse, UpdateLotInput } from "@sadiyakargo/shared";
import { env } from "../../config/env.js";
import { badRequest, conflict, notFound, validation } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { softDeleteOne, tenantFilter } from "../../lib/repository.js";
import {
  buildLotPhotoKey,
  deleteObject,
  getPresignedGetUrl,
  putObject,
} from "../../lib/storage.js";
import { Sender } from "../senders/sender.model.js";
import { Shipment } from "../shipments/shipment.model.js";
import { InboundLot } from "./lot.model.js";

// Photo magic-byte allow-list. TZ §9: never trust the Content-Type header —
// check the actual file signature. Sharp converts everything to JPEG, so
// the final mimeType stored in Mongo is always image/jpeg.
const ALLOWED_PHOTO_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const RESIZE_MAX = 1600;
const JPEG_QUALITY = 80;

interface ListQuery {
  page?: number;
  limit?: number;
  sort?: string;
  senderId?: string;
  status?: string;
  from?: string;
  to?: string;
  availableOnly?: boolean;
}

/**
 * One-hour signed URL for the first photo, so list views (e.g. the shipment
 * lot-picker combobox) can show a thumbnail without an extra round-trip per
 * lot. `undefined` when the lot has no photos.
 */
const FIRST_PHOTO_TTL_SECONDS = 60 * 60;

type LotClient = ReturnType<InstanceType<typeof InboundLot>["toClient"]>;
type LotDocType = InstanceType<typeof InboundLot>;

/**
 * Attach a presigned URL for `photos[0]`. Takes the Mongoose doc because
 * `storageKey` is intentionally not exposed in the client representation
 * (it's an internal S3 layout detail). Failures are logged but never
 * propagate — the caller gets a lot without `firstPhotoUrl` instead of
 * 500, so one broken photo can't take down the whole list view.
 */
async function withFirstPhotoUrl(doc: LotDocType): Promise<LotClient & { firstPhotoUrl?: string }> {
  const client = doc.toClient();
  const first = doc.photos[0];
  if (!first) return client;
  try {
    const firstPhotoUrl = await getPresignedGetUrl(first.storageKey, FIRST_PHOTO_TTL_SECONDS);
    return { ...client, firstPhotoUrl };
  } catch (err) {
    logger.warn({ lotId: client.id, storageKey: first.storageKey, err }, "first_photo_url_failed");
    return client;
  }
}

export async function list(orgId: string, query: ListQuery) {
  const filter = tenantFilter(orgId);
  if (query.senderId) Object.assign(filter, { senderId: new Types.ObjectId(query.senderId) });
  if (query.status) Object.assign(filter, { status: query.status });
  if (query.availableOnly) Object.assign(filter, { qtyAvailable: { $gt: 0 } });
  if (query.from || query.to) {
    const range: Record<string, Date> = {};
    if (query.from) range.$gte = new Date(query.from);
    if (query.to) range.$lte = new Date(query.to);
    Object.assign(filter, { receivedAt: range });
  }
  // We need the Mongoose docs (not toClient'd) so `withFirstPhotoUrl` can
  // read `storageKey`. Re-implement the pagination shape here rather than
  // going through `paginate` which maps to client output.
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const [docs, total] = await Promise.all([
    InboundLot.find(filter)
      .sort({ receivedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    InboundLot.countDocuments(filter),
  ]);
  const data = await Promise.all(docs.map(withFirstPhotoUrl));
  return {
    data,
    pagination: { page, limit, total, hasMore: page * limit < total },
  };
}

export async function get(orgId: string, id: string) {
  const doc = await InboundLot.findOne(tenantFilter(orgId, { _id: new Types.ObjectId(id) }));
  if (!doc) throw notFound("Parti bulunamadı");
  return withFirstPhotoUrl(doc);
}

export async function create(orgId: string, input: CreateLotInput) {
  const sender = await Sender.findOne(
    tenantFilter(orgId, { _id: new Types.ObjectId(input.senderId) })
  );
  if (!sender) throw badRequest("Gönderici bulunamadı");

  const doc = await InboundLot.create({
    orgId: new Types.ObjectId(orgId),
    senderId: sender._id,
    label: input.label ?? "",
    qtyIn: input.qtyIn,
    qtyAvailable: input.qtyIn,
    unitPrice: input.unitPrice ?? null,
    receivedAt: input.receivedAt ? new Date(input.receivedAt) : new Date(),
    notes: input.notes ?? "",
    status: "in_stock",
  });
  return doc.toClient();
}

export async function update(orgId: string, id: string, input: UpdateLotInput) {
  // Per TZ: qty and price are immutable once the lot is in (qtyAvailable
  // is decremented atomically by shipment txns); photos are mutable but
  // only through the dedicated `/lots/:id/photos*` endpoints. Through this
  // PATCH endpoint we only allow correcting the human-facing metadata
  // (label, notes).
  const $set: Record<string, unknown> = {};
  if (input.label !== undefined) $set.label = input.label;
  if (input.notes !== undefined) $set.notes = input.notes;
  const doc = await InboundLot.findOneAndUpdate(
    tenantFilter(orgId, { _id: new Types.ObjectId(id) }),
    { $set },
    { new: true, runValidators: true }
  );
  if (!doc) throw notFound("Parti bulunamadı");
  // Wrap so the TanStack-Query cache update on the web (`qc.setQueryData`)
  // keeps the thumbnail — list/get/photo endpoints all wrap consistently.
  return withFirstPhotoUrl(doc);
}

export async function remove(orgId: string, id: string) {
  const doc = await InboundLot.findOne(tenantFilter(orgId, { _id: new Types.ObjectId(id) }));
  if (!doc) throw notFound("Parti bulunamadı");
  if (doc.qtyAvailable !== doc.qtyIn) {
    throw conflict("Sevkiyatı olan parti silinemez");
  }
  await softDeleteOne(InboundLot, orgId, id);
}

// ────────────────────────────────────────────────────────────────────────────
// Photos
//
// All photos pass through sharp (auto-rotate by EXIF → resize to fit 1600 →
// JPEG q=80) before reaching S3. Originals are NOT stored — TZ §15 keeps the
// bucket small and the schema only tracks the compressed asset.
// ────────────────────────────────────────────────────────────────────────────

export async function addPhotos(orgId: string, lotId: string, files: Express.Multer.File[]) {
  if (files.length === 0) throw badRequest("En az bir fotoğraf yüklemelisiniz");

  const lot = await InboundLot.findOne(tenantFilter(orgId, { _id: new Types.ObjectId(lotId) }));
  if (!lot) throw notFound("Parti bulunamadı");

  const remaining = env.LOT_PHOTO_MAX_COUNT - lot.photos.length;
  if (files.length > remaining) {
    throw conflict(
      `Bu partiye en fazla ${env.LOT_PHOTO_MAX_COUNT} fotoğraf eklenebilir ` +
        `(${lot.photos.length} mevcut, ${remaining} slot kaldı)`
    );
  }

  // Process serially: keeps memory bounded (sharp is CPU-heavy and each input
  // can hit LOT_PHOTO_MAX_BYTES). Track every successful S3 upload — if any
  // later step fails (subsequent file, the final $push, anything), we issue
  // best-effort delete requests so we don't pay for orphan objects.
  const prepared: Array<{
    _id: Types.ObjectId;
    storageKey: string;
    mimeType: string;
    sizeBytes: number;
    width: number;
    height: number;
    uploadedAt: Date;
  }> = [];
  const uploadedKeys: string[] = [];

  try {
    for (const file of files) {
      const detected = await fileTypeFromBuffer(file.buffer);
      if (!detected || !ALLOWED_PHOTO_MIME.has(detected.mime)) {
        throw validation("Sadece JPEG, PNG veya WebP yüklenebilir", {
          fileName: file.originalname,
          detectedMime: detected?.mime ?? null,
        });
      }

      const { data, info } = await sharp(file.buffer)
        .rotate()
        .resize({ width: RESIZE_MAX, height: RESIZE_MAX, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: JPEG_QUALITY })
        .toBuffer({ resolveWithObject: true });

      const photoId = new Types.ObjectId();
      const storageKey = buildLotPhotoKey(orgId, lotId, photoId.toString());
      await putObject(storageKey, data, "image/jpeg");
      uploadedKeys.push(storageKey);

      prepared.push({
        _id: photoId,
        storageKey,
        mimeType: "image/jpeg",
        sizeBytes: data.byteLength,
        width: info.width,
        height: info.height,
        uploadedAt: new Date(),
      });
    }

    // The same `$expr` recheck that capped the initial count must run at
    // commit time — otherwise two concurrent uploads could both pass the
    // initial `remaining` check (lot.photos.length = 8, each adding 2) and
    // the array would silently grow past LOT_PHOTO_MAX_COUNT. When the
    // filter rejects, `updated` is null and the catch block S3-cleans up.
    const updated = await InboundLot.findOneAndUpdate(
      tenantFilter(orgId, {
        _id: new Types.ObjectId(lotId),
        $expr: { $lte: [{ $size: "$photos" }, env.LOT_PHOTO_MAX_COUNT - prepared.length] },
      }),
      { $push: { photos: { $each: prepared } } },
      { new: true }
    );
    if (!updated) {
      // Distinguish between "lot vanished" (rare) and "concurrent upload
      // raced ahead" (the common case) by re-fetching without the $expr.
      const stillExists = await InboundLot.exists(
        tenantFilter(orgId, { _id: new Types.ObjectId(lotId) })
      );
      if (!stillExists) throw notFound("Parti bulunamadı");
      throw conflict(
        `Eşzamanlı yükleme sırasında fotoğraf limiti aşıldı (max ${env.LOT_PHOTO_MAX_COUNT})`
      );
    }
    return await withFirstPhotoUrl(updated);
  } catch (err) {
    if (uploadedKeys.length > 0) {
      // Best-effort cleanup. We log every failed delete so an operator can
      // still find the orphan key in the bucket if the rollback can't keep
      // up — at least the storage isn't silently leaking.
      const cleanup = await Promise.allSettled(uploadedKeys.map((k) => deleteObject(k)));
      for (let i = 0; i < cleanup.length; i += 1) {
        const r = cleanup[i];
        if (r.status === "rejected") {
          logger.warn(
            { storageKey: uploadedKeys[i], err: r.reason },
            "lot_photo_orphan_cleanup_failed"
          );
        }
      }
      logger.warn(
        {
          orgId,
          lotId,
          attempted: files.length,
          uploaded: uploadedKeys.length,
          cleaned: cleanup.filter((r) => r.status === "fulfilled").length,
          err,
        },
        "lot_photo_upload_partial"
      );
    }
    throw err;
  }
}

export async function removePhoto(orgId: string, lotId: string, photoId: string) {
  const lot = await InboundLot.findOne(tenantFilter(orgId, { _id: new Types.ObjectId(lotId) }));
  if (!lot) throw notFound("Parti bulunamadı");

  const photo = lot.photos.find((p) => p._id.toString() === photoId);
  if (!photo) throw notFound("Fotoğraf bulunamadı");

  // Delete from S3 first; if Mongo $pull fails afterwards the photo is orphaned
  // in the DB pointing to a missing object, which surfaces as a 404 on the
  // presigned URL — recoverable. The reverse order leaves dangling objects.
  await deleteObject(photo.storageKey);
  const updated = await InboundLot.findOneAndUpdate(
    tenantFilter(orgId, { _id: new Types.ObjectId(lotId) }),
    { $pull: { photos: { _id: new Types.ObjectId(photoId) } } },
    { new: true }
  );
  if (!updated) throw notFound("Parti bulunamadı");
  return withFirstPhotoUrl(updated);
}

export async function reorderPhotos(orgId: string, lotId: string, photoIds: string[]) {
  const lot = await InboundLot.findOne(tenantFilter(orgId, { _id: new Types.ObjectId(lotId) }));
  if (!lot) throw notFound("Parti bulunamadı");

  if (photoIds.length !== lot.photos.length) {
    throw badRequest("Tüm mevcut fotoğraf id'leri sırada gönderilmelidir", {
      expected: lot.photos.length,
      received: photoIds.length,
    });
  }
  if (new Set(photoIds).size !== photoIds.length) {
    throw badRequest("Sırada tekrar eden fotoğraf id'si var");
  }

  // Build a lookup of the existing subdocs by id; if any incoming id is
  // unknown the request describes a different set, not a permutation. The
  // PhotoRef shape in this module is a plain TS interface (not a Mongoose
  // subdoc), so we copy fields explicitly instead of calling .toObject().
  const photoById = new Map(
    lot.photos.map((p) => [
      p._id.toString(),
      {
        _id: p._id,
        storageKey: p.storageKey,
        mimeType: p.mimeType,
        sizeBytes: p.sizeBytes,
        width: p.width,
        height: p.height,
        uploadedAt: p.uploadedAt,
      },
    ])
  );
  const reordered: ReturnType<typeof photoById.get>[] = [];
  for (const id of photoIds) {
    const found = photoById.get(id);
    if (!found) throw badRequest(`Bilinmeyen fotoğraf id: ${id}`);
    reordered.push(found);
  }

  const updated = await InboundLot.findOneAndUpdate(
    tenantFilter(orgId, { _id: new Types.ObjectId(lotId) }),
    { $set: { photos: reordered } },
    { new: true }
  );
  if (!updated) throw notFound("Parti bulunamadı");
  return withFirstPhotoUrl(updated);
}

export async function getPhotoUrl(
  orgId: string,
  lotId: string,
  photoId: string
): Promise<SignedPhotoUrlResponse> {
  const lot = await InboundLot.findOne(tenantFilter(orgId, { _id: new Types.ObjectId(lotId) }));
  if (!lot) throw notFound("Parti bulunamadı");

  const photo = lot.photos.find((p) => p._id.toString() === photoId);
  if (!photo) throw notFound("Fotoğraf bulunamadı");

  const ttl = env.LOT_PHOTO_PRESIGNED_TTL_SECONDS;
  const url = await getPresignedGetUrl(photo.storageKey, ttl);
  return { url, expiresAt: new Date(Date.now() + ttl * 1000).toISOString() };
}

interface StockBreakdownRow {
  id: string;
  name: string;
  totalAvailable: number;
  lots: number;
}

export async function stockBySender(orgId: string): Promise<StockBreakdownRow[]> {
  const rows = await InboundLot.aggregate<{
    _id: Types.ObjectId;
    totalAvailable: number;
    lots: number;
    name?: string;
  }>([
    { $match: { ...tenantFilter(orgId), qtyAvailable: { $gt: 0 } } },
    {
      $group: {
        _id: "$senderId",
        totalAvailable: { $sum: "$qtyAvailable" },
        lots: { $sum: 1 },
      },
    },
    // Pipeline-form lookup so we can apply the same tenant + soft-delete
    // filter that every direct Sender query uses. A plain $lookup would
    // surface deleted senders' names in the stock report.
    {
      $lookup: {
        from: "senders",
        let: { sid: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$_id", "$$sid"] },
              orgId: new Types.ObjectId(orgId),
              deletedAt: null,
            },
          },
          { $project: { fullName: 1 } },
        ],
        as: "sender",
      },
    },
    {
      $project: {
        _id: 1,
        totalAvailable: 1,
        lots: 1,
        name: { $arrayElemAt: ["$sender.fullName", 0] },
      },
    },
    { $sort: { totalAvailable: -1 } },
  ]);

  return rows.map((r) => ({
    id: r._id.toString(),
    name: r.name || "—",
    totalAvailable: r.totalAvailable,
    lots: r.lots,
  }));
}

/**
 * Drill-down: every shipment that pulled stock from this lot, with the qty
 * taken in that shipment, the carrier id, recipient, and current status. Used
 * by the depo UI to answer "when / to whom did this lot go out?". Tenant +
 * soft-delete checks are explicit so a forged lotId can't escape org scope.
 */
export async function shipmentsForLot(orgId: string, lotId: string) {
  const lot = await InboundLot.findOne(tenantFilter(orgId, { _id: new Types.ObjectId(lotId) }));
  if (!lot) throw notFound("Parti bulunamadı");

  const shipments = await Shipment.find(
    tenantFilter(orgId, { "items.lotId": new Types.ObjectId(lotId) })
  ).sort({ shipmentDate: -1 });

  // Project only the matching item's qty — a shipment may reference multiple
  // lots, but for this view we want the slice tied to lotId.
  return shipments.map((s) => {
    const item = s.items.find((it) => it.lotId.toString() === lotId);
    return {
      shipmentId: s._id.toString(),
      shortCode: s.shortCode,
      shipmentDate: s.shipmentDate.toISOString(),
      status: s.status,
      carrierId: s.carrierId.toString(),
      qty: item?.qty ?? 0,
      recipient: s.recipient
        ? { name: s.recipient.name, phone: s.recipient.phone, addressTr: s.recipient.addressTr }
        : null,
    };
  });
}
