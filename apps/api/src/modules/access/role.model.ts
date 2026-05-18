import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export interface RoleDoc extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  name: string;
  description: string;
  /**
   * Flat list of permission keys (strings). Mirrors the `permissions.key`
   * column rather than ObjectId references so that permissions can be deleted
   * without cascading rewrites — `requirePermission` just checks string
   * membership.
   */
  permissions: string[];
  /** Seeded by migration; cannot be deleted via the admin UI. */
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
  toClient(): {
    id: string;
    name: string;
    description: string;
    permissions: string[];
    isSystem: boolean;
    createdAt: string;
    updatedAt: string;
  };
}

const roleSchema = new Schema<RoleDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    permissions: { type: [String], default: [] },
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true }
);

roleSchema.index({ orgId: 1, name: 1 }, { unique: true });

roleSchema.methods.toClient = function toClient() {
  return {
    id: this._id.toString(),
    name: this.name,
    description: this.description,
    permissions: [...this.permissions],
    isSystem: this.isSystem,
    createdAt: this.createdAt.toISOString(),
    updatedAt: this.updatedAt.toISOString(),
  };
};

export const Role: Model<RoleDoc> =
  (mongoose.models.Role as Model<RoleDoc>) || mongoose.model<RoleDoc>("Role", roleSchema);
