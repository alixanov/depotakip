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
    throw badRequest("err:unknown_permissions", { keys: missing.join(", ") });
  }
}

export async function list(orgId: string): Promise<RoleWithUserCount[]> {
  const orgObjectId = new Types.ObjectId(orgId);
  const roles = await Role.find({ orgId: orgObjectId }).sort({ isSystem: -1, name: 1 });

  const counts = await User.aggregate<{ _id: Types.ObjectId; n: number }>([
    { $match: { orgId: orgObjectId, deletedAt: null } },
    { $group: { _id: "$roleId", n: { $sum: 1 } } },
  ]);
  const countByRole = new Map(counts.map((c) => [c._id.toString(), c.n]));

  return roles.map((r) => ({ ...r.toClient(), userCount: countByRole.get(r._id.toString()) ?? 0 }));
}

export async function get(orgId: string, id: string) {
  const doc = await Role.findOne({ _id: new Types.ObjectId(id), orgId: new Types.ObjectId(orgId) });
  if (!doc) throw notFound("err:role_not_found");
  return doc.toClient();
}

export async function create(orgId: string, input: CreateRoleInput) {
  await assertPermissionsExist(input.permissions);
  const existing = await Role.findOne({ orgId: new Types.ObjectId(orgId), name: input.name });
  if (existing) throw conflict("err:role_name_taken");
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
  const orgObjectId = new Types.ObjectId(orgId);
  const doc = await Role.findOne({ _id: new Types.ObjectId(id), orgId: orgObjectId });
  if (!doc) throw notFound("err:role_not_found");

  // System roles are locked: only description is editable. Allowing rename
  // or permission edits would break `ensureAdmin` lookups (by name) and the
  // lockout guard that depends on `name === "admin"`. Custom-create a new
  // role if you need a different configuration.
  if (doc.isSystem) {
    if (input.name !== undefined && input.name !== doc.name) {
      throw conflict("err:system_role_locked_name");
    }
    if (input.permissions !== undefined) {
      throw conflict("err:system_role_locked_perms");
    }
  }

  // Explicit duplicate-name check produces a useful message instead of the
  // generic E11000 "Kayıt zaten mevcut" from the central error handler.
  if (input.name !== undefined && input.name !== doc.name) {
    const clash = await Role.findOne({
      orgId: orgObjectId,
      name: input.name,
      _id: { $ne: doc._id },
    });
    if (clash) throw conflict("err:role_name_taken");
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
  if (!doc) throw notFound("err:role_not_found");
  if (doc.isSystem) throw conflict("err:system_role_locked_delete");
  const inUse = await User.countDocuments({
    orgId: new Types.ObjectId(orgId),
    roleId: doc._id,
    deletedAt: null,
  });
  if (inUse > 0) throw conflict("err:role_in_use", { count: inUse });
  await Role.deleteOne({ _id: doc._id });
}
