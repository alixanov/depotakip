import { Types } from "mongoose";
import {
  createSenderSchema,
  type BulkImportReport,
  type CreateSenderInput,
  type UpdateSenderInput,
} from "@sadiyakargo/shared";
import { conflict, notFound } from "../../lib/errors.js";
import { paginate, softDeleteOne, tenantFilter } from "../../lib/repository.js";
import type { BulkImportRow } from "../../lib/bulkImport.js";
import { Sender } from "./sender.model.js";

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
        { fullName: { $regex: query.search, $options: "i" } },
        { phone: { $regex: query.search, $options: "i" } },
      ],
    });
  }
  return paginate(Sender, filter, query, (d) => d.toClient());
}

export async function get(orgId: string, id: string) {
  const doc = await Sender.findOne(tenantFilter(orgId, { _id: new Types.ObjectId(id) }));
  if (!doc) throw notFound("err:sender_not_found");
  return doc.toClient();
}

export async function create(orgId: string, input: CreateSenderInput) {
  // Защита от случайных дубликатов phone в одной орг — индекс не unique.
  // phone теперь опциональный: пустой не считается дубликатом (иначе
  // нельзя было бы создать второго sender'а без номера).
  if (input.phone) {
    const existing = await Sender.findOne(tenantFilter(orgId, { phone: input.phone }));
    if (existing) throw conflict("err:phone_taken_sender");
  }
  const doc = await Sender.create({ orgId: new Types.ObjectId(orgId), ...input });
  return doc.toClient();
}

export async function update(orgId: string, id: string, input: UpdateSenderInput) {
  // При смене телефона — та же проверка, исключая текущий sender.
  if (input.phone) {
    const clash = await Sender.findOne(
      tenantFilter(orgId, { phone: input.phone, _id: { $ne: new Types.ObjectId(id) } })
    );
    if (clash) throw conflict("err:phone_taken_sender");
  }
  const doc = await Sender.findOneAndUpdate(
    tenantFilter(orgId, { _id: new Types.ObjectId(id) }),
    { $set: input },
    { new: true, runValidators: true }
  );
  if (!doc) throw notFound("err:sender_not_found");
  return doc.toClient();
}

export async function remove(orgId: string, id: string) {
  const doc = await softDeleteOne(Sender, orgId, id);
  if (!doc) throw notFound("err:sender_not_found");
}

/** Колонки для импорта senders. Используется и парсером (валидация имён),
 *  и template-генератором. */
export const SENDER_IMPORT_COLUMNS = ["fullName", "phone", "address", "notes"] as const;

export interface BulkImportOptions {
  onDuplicate: "skip" | "update";
}

/**
 * Bulk-import senders. Partial best-effort: каждая строка независимо.
 * Дубликаты phone (в БД или в самом файле) обрабатываются согласно
 * `options.onDuplicate`. Возвращает отчёт для оператора.
 */
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

  // Один pre-fetch всех существующих phone'ов из файла — избегает N+1.
  const inputPhones = rows.map((r) => (r.data.phone ?? "").trim()).filter(Boolean);
  const existing = inputPhones.length
    ? await Sender.find(tenantFilter(orgId, { phone: { $in: inputPhones } }), {
        phone: 1,
        _id: 1,
      })
    : [];
  const existingByPhone = new Map(existing.map((s) => [s.phone, s._id]));

  // Защита от дублей внутри одного файла (приоритет первой попавшейся).
  const seenInBatch = new Set<string>();

  for (const { row, data } of rows) {
    const input = {
      fullName: (data.fullName ?? "").trim(),
      phone: (data.phone ?? "").trim(),
      address: (data.address ?? "").trim(),
      notes: (data.notes ?? "").trim(),
      isSelf: false,
    };
    const parsed = createSenderSchema.safeParse(input);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((iss) => ({
        path: iss.path.join(".") || "?",
        message: iss.message,
      }));
      report.failed.push({
        row,
        reason: issues.map((i) => `${i.path}: ${i.message}`).join("; "),
        code: "err:bulk_row_invalid",
        issues,
      });
      continue;
    }
    const { phone } = parsed.data;
    // phone опционален: пустой не дедуплицируется (один файл может
    // содержать сколько угодно записей без телефона).
    if (phone && seenInBatch.has(phone)) {
      report.failed.push({
        row,
        reason: `Дубликат phone в файле (${phone})`,
        code: "err:bulk_dup_phone_in_file",
        params: { phone },
      });
      continue;
    }
    if (phone) seenInBatch.add(phone);

    const existingId = phone ? existingByPhone.get(phone) : undefined;
    if (existingId) {
      if (options.onDuplicate === "skip") {
        report.skippedDuplicates += 1;
        continue;
      }
      // update
      try {
        await Sender.updateOne({ _id: existingId }, { $set: parsed.data });
        report.updated += 1;
      } catch (err) {
        report.failed.push({
          row,
          reason: err instanceof Error ? err.message : "Ошибка обновления",
          code: "err:bulk_update_failed",
        });
      }
      continue;
    }
    try {
      await Sender.create({ orgId: orgObjectId, ...parsed.data });
      report.created += 1;
    } catch (err) {
      report.failed.push({
        row,
        reason: err instanceof Error ? err.message : "Ошибка создания",
        code: "err:bulk_create_failed",
      });
    }
  }

  return report;
}
