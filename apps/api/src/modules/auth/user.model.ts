import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import type { UserRoleRef } from "@sadiyakargo/shared";
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

/** Helper used by controllers/services to resolve a user's role view. */
export async function loadRoleRef(roleId: Types.ObjectId): Promise<UserRoleRef> {
  const role = await Role.findById(roleId);
  if (!role) {
    // Stale roleId — should not happen if delete is gated, but fall back to
    // a safe empty role rather than crashing.
    return { id: roleId.toString(), name: "(missing)", isSystem: false, permissions: [] };
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
