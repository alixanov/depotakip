import { Types } from "mongoose";
import type { CreateCategoryInput, UpdateCategoryInput } from "@sadiyakargo/shared";
import { conflict, notFound } from "../../lib/errors.js";
import { softDeleteOne, tenantFilter } from "../../lib/repository.js";
import { Category } from "./category.model.js";

export async function list(orgId: string, query: { activeOnly?: boolean } = {}) {
  const filter = tenantFilter(orgId, query.activeOnly ? { active: true } : {});
  const docs = await Category.find(filter).sort({ sortOrder: 1, name: 1 });
  return docs.map((d) => d.toClient());
}

export async function get(orgId: string, id: string) {
  const doc = await Category.findOne(tenantFilter(orgId, { _id: new Types.ObjectId(id) }));
  if (!doc) throw notFound("Kategori bulunamadı");
  return doc.toClient();
}

export async function create(orgId: string, input: CreateCategoryInput) {
  // Mongoose collation indexes are racy in tests; do an explicit case-insensitive
  // pre-check, plus rely on the unique index as backup.
  const existing = await Category.findOne(
    tenantFilter(orgId, {
      name: { $regex: `^${escapeRegex(input.name)}$`, $options: "i" },
    })
  );
  if (existing) throw conflict("Bu kategori zaten mevcut");
  try {
    const doc = await Category.create({
      orgId: new Types.ObjectId(orgId),
      ...input,
    });
    return doc.toClient();
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: number }).code === 11000
    ) {
      throw conflict("Bu kategori zaten mevcut");
    }
    throw err;
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function update(orgId: string, id: string, input: UpdateCategoryInput) {
  const doc = await Category.findOneAndUpdate(
    tenantFilter(orgId, { _id: new Types.ObjectId(id) }),
    { $set: input },
    { new: true, runValidators: true }
  );
  if (!doc) throw notFound("Kategori bulunamadı");
  return doc.toClient();
}

export async function remove(orgId: string, id: string) {
  const doc = await softDeleteOne(Category, orgId, id);
  if (!doc) throw notFound("Kategori bulunamadı");
}
