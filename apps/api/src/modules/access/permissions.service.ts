import type { CreatePermissionInput, UpdatePermissionInput } from "@sadiyakargo/shared";
import { Types } from "mongoose";
import { conflict, notFound } from "../../lib/errors.js";
import { Permission } from "./permission.model.js";
import { Role } from "./role.model.js";

export async function list() {
  const docs = await Permission.find({}).sort({ group: 1, key: 1 });
  return docs.map((d) => d.toClient());
}

export async function get(id: string) {
  const doc = await Permission.findById(id);
  if (!doc) throw notFound("Yetki bulunamadı");
  return doc.toClient();
}

export async function create(input: CreatePermissionInput) {
  const existing = await Permission.findOne({ key: input.key.toLowerCase() });
  if (existing) throw conflict("Bu anahtar zaten kayıtlı");
  const doc = await Permission.create({
    key: input.key.toLowerCase(),
    label: input.label,
    description: input.description ?? "",
    group: input.group ?? null,
    isSystem: false,
  });
  return doc.toClient();
}

export async function update(id: string, input: UpdatePermissionInput) {
  const $set: Record<string, unknown> = {};
  if (input.label !== undefined) $set.label = input.label;
  if (input.description !== undefined) $set.description = input.description;
  if (input.group !== undefined) $set.group = input.group;
  const doc = await Permission.findByIdAndUpdate(id, { $set }, { new: true });
  if (!doc) throw notFound("Yetki bulunamadı");
  return doc.toClient();
}

export async function remove(id: string) {
  const doc = await Permission.findById(id);
  if (!doc) throw notFound("Yetki bulunamadı");
  if (doc.isSystem) throw conflict("Sistem yetkisi silinemez");
  // Pull the key out of every role that still grants it so we don't leave
  // orphaned strings around.
  await Role.updateMany({ permissions: doc.key }, { $pull: { permissions: doc.key } });
  await Permission.deleteOne({ _id: new Types.ObjectId(id) });
}
