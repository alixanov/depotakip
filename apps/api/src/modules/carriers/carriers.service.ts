import { Types } from "mongoose";
import {
  createCarrierSchema,
  type BulkImportReport,
  type CreateCarrierInput,
  type UpdateCarrierInput,
} from "@sadiyakargo/shared";
import { conflict, notFound } from "../../lib/errors.js";
import { paginate, softDeleteOne, tenantFilter } from "../../lib/repository.js";
import type { BulkImportRow } from "../../lib/bulkImport.js";
import { Carrier } from "./carrier.model.js";

interface ListQuery {
  page?: number;
  limit?: number;
  search?: string;
}

export async function list(orgId: string, query: ListQuery) {
  const filter = tenantFilter(orgId);
  if (query.search) {
    Object.assign(filter, {
      $or: [
        { firstName: { $regex: query.search, $options: "i" } },
        { lastName: { $regex: query.search, $options: "i" } },
        { phone: { $regex: query.search, $options: "i" } },
      ],
    });
  }
  return paginate(Carrier, filter, query, (d) => d.toClient());
}

export async function get(orgId: string, id: string) {
  const doc = await Carrier.findOne(tenantFilter(orgId, { _id: new Types.ObjectId(id) }));
  if (!doc) throw notFound("Kargocu bulunamadı");
  return doc.toClient();
}

export async function create(orgId: string, input: CreateCarrierInput) {
  // Защита от случайных дубликатов: индекс не unique, поэтому проверяем
  // на уровне сервиса. Если phone уже занят активным перевозчиком в этой
  // орг — отказ. Soft-deleted перевозчики не блокируют (можно «вернуть»).
  const existing = await Carrier.findOne(tenantFilter(orgId, { phone: input.phone }));
  if (existing) throw conflict("Bu telefon numarası başka bir kargocuya atanmış");
  const doc = await Carrier.create({ orgId: new Types.ObjectId(orgId), ...input });
  return doc.toClient();
}

export async function update(orgId: string, id: string, input: UpdateCarrierInput) {
  if (input.phone) {
    const clash = await Carrier.findOne(
      tenantFilter(orgId, { phone: input.phone, _id: { $ne: new Types.ObjectId(id) } })
    );
    if (clash) throw conflict("Bu telefon numarası başka bir kargocuya atanmış");
  }
  const doc = await Carrier.findOneAndUpdate(
    tenantFilter(orgId, { _id: new Types.ObjectId(id) }),
    { $set: input },
    { new: true, runValidators: true }
  );
  if (!doc) throw notFound("Kargocu bulunamadı");
  return doc.toClient();
}

export async function remove(orgId: string, id: string) {
  const doc = await softDeleteOne(Carrier, orgId, id);
  if (!doc) throw notFound("Kargocu bulunamadı");
}

export const CARRIER_IMPORT_COLUMNS = [
  "firstName",
  "lastName",
  "phone",
  "deliveryAddressTr",
  "notes",
] as const;

export interface BulkImportOptions {
  onDuplicate: "skip" | "update";
}

/** Bulk-import carriers. Partial best-effort; см. senders.bulkImport. */
export async function bulkImport(
  orgId: string,
  rows: BulkImportRow[],
  options: BulkImportOptions
): Promise<BulkImportReport> {
  const report: BulkImportReport = {
    total: rows.length,
    created: 0,
    updated: 0,
    skippedDuplicates: 0,
    failed: [],
  };
  const orgObjectId = new Types.ObjectId(orgId);

  const inputPhones = rows.map((r) => (r.data.phone ?? "").trim()).filter(Boolean);
  const existing = inputPhones.length
    ? await Carrier.find(tenantFilter(orgId, { phone: { $in: inputPhones } }), {
        phone: 1,
        _id: 1,
      })
    : [];
  const existingByPhone = new Map(existing.map((c) => [c.phone, c._id]));

  const seenInBatch = new Set<string>();

  for (const { row, data } of rows) {
    const input = {
      firstName: (data.firstName ?? "").trim(),
      lastName: (data.lastName ?? "").trim(),
      phone: (data.phone ?? "").trim(),
      deliveryAddressTr: (data.deliveryAddressTr ?? "").trim(),
      notes: (data.notes ?? "").trim(),
    };
    const parsed = createCarrierSchema.safeParse(input);
    if (!parsed.success) {
      report.failed.push({
        row,
        reason: parsed.error.issues
          .map((iss) => `${iss.path.join(".") || "?"}: ${iss.message}`)
          .join("; "),
      });
      continue;
    }
    const { phone } = parsed.data;
    if (seenInBatch.has(phone)) {
      report.failed.push({ row, reason: `Дубликат phone в файле (${phone})` });
      continue;
    }
    seenInBatch.add(phone);

    const existingId = existingByPhone.get(phone);
    if (existingId) {
      if (options.onDuplicate === "skip") {
        report.skippedDuplicates += 1;
        continue;
      }
      try {
        await Carrier.updateOne({ _id: existingId }, { $set: parsed.data });
        report.updated += 1;
      } catch (err) {
        report.failed.push({
          row,
          reason: err instanceof Error ? err.message : "Ошибка обновления",
        });
      }
      continue;
    }
    try {
      await Carrier.create({ orgId: orgObjectId, ...parsed.data });
      report.created += 1;
    } catch (err) {
      report.failed.push({
        row,
        reason: err instanceof Error ? err.message : "Ошибка создания",
      });
    }
  }

  return report;
}
