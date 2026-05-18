import { Types } from "mongoose";
import sharp from "sharp";
import { fileTypeFromBuffer } from "file-type";
import type { CreateLotInput, SignedPhotoUrlResponse, UpdateLotInput } from "@sadiyakargo/shared";
import { env } from "../../config/env.js";
import { badRequest, conflict, notFound, validation } from "../../lib/errors.js";
import { paginate, softDeleteOne, tenantFilter } from "../../lib/repository.js";
import {
  buildLotPhotoKey,
  deleteObject,
  getPresignedGetUrl,
  putObject,
} from "../../lib/storage.js";
import { Sender } from "../senders/sender.model.js";
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
  return paginate(InboundLot, filter, query, (d) => d.toClient(), { receivedAt: -1 });
}

export async function get(orgId: string, id: string) {
  const doc = await InboundLot.findOne(tenantFilter(orgId, { _id: new Types.ObjectId(id) }));
  if (!doc) throw notFound("Parti bulunamadı");
  return doc.toClient();
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
  // Per TZ: qty/photo/price are immutable once the lot is in (qtyAvailable
  // is decremented atomically by shipment txns). Only the human-facing
  // metadata — label and notes — can be corrected.
  const $set: Record<string, unknown> = {};
  if (input.label !== undefined) $set.label = input.label;
  if (input.notes !== undefined) $set.notes = input.notes;
  const doc = await InboundLot.findOneAndUpdate(
    tenantFilter(orgId, { _id: new Types.ObjectId(id) }),
    { $set },
    { new: true, runValidators: true }
  );
  if (!doc) throw notFound("Parti bulunamadı");
  return doc.toClient();
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
  // can hit LOT_PHOTO_MAX_BYTES). If an upload to S3 fails midway, the already
  // uploaded objects become orphans — acceptable trade-off; a periodic
  // cleanup script can reconcile against `inboundLots.photos[].storageKey`.
  const prepared: Array<{
    _id: Types.ObjectId;
    storageKey: string;
    mimeType: string;
    sizeBytes: number;
    width: number;
    height: number;
    uploadedAt: Date;
  }> = [];

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

  const updated = await InboundLot.findOneAndUpdate(
    tenantFilter(orgId, { _id: new Types.ObjectId(lotId) }),
    { $push: { photos: { $each: prepared } } },
    { new: true }
  );
  if (!updated) throw notFound("Parti bulunamadı");
  return updated.toClient();
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
  return updated.toClient();
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
    {
      $lookup: {
        from: "senders",
        localField: "_id",
        foreignField: "_id",
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
