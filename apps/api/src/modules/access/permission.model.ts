import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import type { PermissionGroup } from "@sadiyakargo/shared";

export interface PermissionDoc extends Document {
  _id: Types.ObjectId;
  key: string;
  label: string;
  description: string;
  group: PermissionGroup | null;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
  toClient(): {
    id: string;
    key: string;
    label: string;
    description: string;
    group: PermissionGroup | null;
    isSystem: boolean;
    createdAt: string;
    updatedAt: string;
  };
}

const permissionSchema = new Schema<PermissionDoc>(
  {
    key: { type: String, required: true, unique: true, trim: true, lowercase: true },
    label: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    group: {
      type: String,
      enum: ["warehouse", "shipments", "finance", "reference", "reports", "admin"],
      default: null,
    },
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true }
);

permissionSchema.index({ group: 1, key: 1 });

permissionSchema.methods.toClient = function toClient() {
  return {
    id: this._id.toString(),
    key: this.key,
    label: this.label,
    description: this.description,
    group: this.group,
    isSystem: this.isSystem,
    createdAt: this.createdAt.toISOString(),
    updatedAt: this.updatedAt.toISOString(),
  };
};

export const Permission: Model<PermissionDoc> =
  (mongoose.models.Permission as Model<PermissionDoc>) ||
  mongoose.model<PermissionDoc>("Permission", permissionSchema);
