import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import type { UserRoleRef } from "@sadiyakargo/shared";
import { unauthorized } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { Role } from "../access/role.model.js";

export interface UserDoc extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  email: string;
  passwordHash: string;
  fullName: string;
  phone?: string;
  /** Role-based access control; replaces the legacy `role` enum string. */
  roleId: Types.ObjectId;
  active: boolean;
  mustChangePassword: boolean;
  lastLoginAt?: Date | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  toSafeJSON(role: UserRoleRef): {
    id: string;
    email: string;
    fullName: string;
    phone?: string;
    role: UserRoleRef;
    active: boolean;
    lastLoginAt: string | null;
  };
}

const userSchema = new Schema<UserDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    roleId: { type: Schema.Types.ObjectId, ref: "Role", required: true },
    active: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: false },
    lastLoginAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ orgId: 1, roleId: 1 });

// Role is denormalised into the JSON response so callers don't have to
// remember to populate. The role document is loaded once per call site
// (auth.service.me, users.controller.list, etc).
userSchema.methods.toSafeJSON = function toSafeJSON(role: UserRoleRef) {
  return {
    id: this._id.toString(),
    email: this.email,
    fullName: this.fullName,
    phone: this.phone,
    role,
    active: this.active,
    lastLoginAt: this.lastLoginAt ? this.lastLoginAt.toISOString() : null,
  };
};

/**
 * Resolve a user's role for the auth/me response and the JWT payload. A
 * missing role is a corruption signal — `roles.service.remove` blocks
 * deletion of in-use roles, so reaching this path means manual DB tampering
 * or a partially-applied migration. We log + throw so the user gets a clear
 * "ask the admin" message instead of an empty-permissions shell that 403s
 * on every click.
 */
export async function loadRoleRef(roleId: Types.ObjectId): Promise<UserRoleRef> {
  const role = await Role.findById(roleId);
  if (!role) {
    logger.error({ roleId: roleId.toString() }, "user_role_missing");
    throw unauthorized("Atanmış rol artık mevcut değil — yönetici ile iletişime geçin");
  }
  return {
    id: role._id.toString(),
    name: role.name,
    isSystem: role.isSystem,
    permissions: [...role.permissions],
  };
}

export const User: Model<UserDoc> =
  (mongoose.models.User as Model<UserDoc>) || mongoose.model<UserDoc>("User", userSchema);
