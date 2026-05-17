import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import type { Role } from "@depotakip/shared";

export interface UserDoc extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  email: string;
  passwordHash: string;
  fullName: string;
  phone?: string;
  role: Role;
  active: boolean;
  mustChangePassword: boolean;
  lastLoginAt?: Date | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  toSafeJSON(): {
    id: string;
    email: string;
    fullName: string;
    phone?: string;
    role: Role;
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
    role: {
      type: String,
      required: true,
      enum: ["admin", "operator", "viewer"],
    },
    active: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: false },
    lastLoginAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ orgId: 1, role: 1 });

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id.toString(),
    email: this.email,
    fullName: this.fullName,
    phone: this.phone,
    role: this.role,
    active: this.active,
    lastLoginAt: this.lastLoginAt ? this.lastLoginAt.toISOString() : null,
  };
};

export const User: Model<UserDoc> =
  (mongoose.models.User as Model<UserDoc>) || mongoose.model<UserDoc>("User", userSchema);
