import { Types } from "mongoose";
import type { CreateRoleInput, UpdateRoleInput } from "@sadiyakargo/shared";
import { badRequest, conflict, notFound } from "../../lib/errors.js";
import { User } from "../auth/user.model.js";
import { Permission } from "./permission.model.js";
import { Role } from "./role.model.js";

interface RoleWithUserCount {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Verify every permission key actually exists; reject the request otherwise. */
async function assertPermissionsExist(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const known = await Permission.find({ key: { $in: keys } }, { key: 1, _id: 0 });
  const knownSet = new Set(known.map((p) => p.key));
  const missing = keys.filter((k) => !knownSet.has(k));
  if (missing.length > 0) {
    throw badRequest(`Bilinmeyen yetki: ${missing.join(", ")}`);
  }
}

export async function list(orgId: string): Promise<RoleWithUserCount[]> {
  const orgObjectId = new Types.ObjectId(orgId);
  const roles = await Role.find({ orgId: orgObjectId }).sort({ isSystem: -1, name: 1 });

  // Single aggregation gives us userCount per role so the admin UI can disable
  // the Delete button for in-use roles without N+1 queries.
  const counts = await User.aggregate<{ _id: Types.ObjectId; n: number }>([
    { $match: { orgId: orgObjectId, deletedAt: null } },
    { $group: { _id: "$roleId", n: { $sum: 1 } } },
  ]);
  const countByRole = new Map(counts.map((c) => [c._id.toString(), c.n]));

  return roles.map((r) => ({ ...r.toClient(), userCount: countByRole.get(r._id.toString()) ?? 0 }));
}

export async function get(orgId: string, id: string) {
  const doc = await Role.findOne({ _id: new Types.ObjectId(id), orgId: new Types.ObjectId(orgId) });
  if (!doc) throw notFound("Rol bulunamadı");
  return doc.toClient();
}

export async function create(orgId: string, input: CreateRoleInput) {
  await assertPermissionsExist(input.permissions);
  const existing = await Role.findOne({ orgId: new Types.ObjectId(orgId), name: input.name });
  if (existing) throw conflict("Bu isimde rol zaten var");
  const doc = await Role.create({
    orgId: new Types.ObjectId(orgId),
    name: input.name,
    description: input.description ?? "",
    permissions: input.permissions,
    isSystem: false,
  });
  return doc.toClient();
}

export async function update(orgId: string, id: string, input: UpdateRoleInput) {
  const doc = await Role.findOne({
    _id: new Types.ObjectId(id),
    orgId: new Types.ObjectId(orgId),
  });
  if (!doc) throw notFound("Rol bulunamadı");
  if (doc.isSystem && doc.name === "admin" && input.permissions) {
    // Lockout protection — the seeded admin role must always retain full
    // privileges so at least one account can manage RBAC.
    throw conflict("Sistem admin rolünün yetkileri değiştirilemez");
  }
  if (input.permissions) await assertPermissionsExist(input.permissions);
  if (input.name !== undefined) doc.name = input.name;
  if (input.description !== undefined) doc.description = input.description;
  if (input.permissions !== undefined) doc.permissions = [...input.permissions];
  await doc.save();
  return doc.toClient();
}

export async function remove(orgId: string, id: string) {
  const doc = await Role.findOne({
    _id: new Types.ObjectId(id),
    orgId: new Types.ObjectId(orgId),
  });
  if (!doc) throw notFound("Rol bulunamadı");
  if (doc.isSystem) throw conflict("Sistem rolü silinemez");
  const inUse = await User.countDocuments({
    orgId: new Types.ObjectId(orgId),
    roleId: doc._id,
    deletedAt: null,
  });
  if (inUse > 0) throw conflict(`Bu rol ${inUse} kullanıcıya atanmış — önce başka role aktarın`);
  await Role.deleteOne({ _id: doc._id });
}
