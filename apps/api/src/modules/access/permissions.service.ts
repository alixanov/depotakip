import type { CreatePermissionInput, UpdatePermissionInput } from "@sadiyakargo/shared";
import { Types } from "mongoose";
import { conflict, notFound } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
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
  // permissionKeySchema требует регексом `[a-z0-9_]` — input.key уже lowercase.
  const existing = await Permission.findOne({ key: input.key });
  if (existing) throw conflict("Bu anahtar zaten kayıtlı");
  const doc = await Permission.create({
    key: input.key,
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
  // Snapshot affected roles BEFORE pulling so the audit log can describe the
  // silent privilege downgrade ("role X used to grant 'lots:foo' until perm
  // <id> was deleted at <ts>"). Without this trail a sudden 403 cascade is
  // hard to explain in retrospect.
  const affected = await Role.find({ permissions: doc.key }, { name: 1, orgId: 1, _id: 0 });
  await Role.updateMany({ permissions: doc.key }, { $pull: { permissions: doc.key } });
  await Permission.deleteOne({ _id: new Types.ObjectId(id) });
  if (affected.length > 0) {
    logger.warn(
      {
        permissionKey: doc.key,
        affectedRoles: affected.map((r) => ({
          name: r.name,
          orgId: r.orgId.toString(),
        })),
      },
      "permission_deleted_with_roles"
    );
  }
}
