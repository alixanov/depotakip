import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export interface RefreshTokenDoc extends Document {
  _id: Types.ObjectId;
  tokenId: string;
  userId: Types.ObjectId;
  orgId: Types.ObjectId;
  userAgent: string;
  ip: string;
  issuedAt: Date;
  expiresAt: Date;
  revokedAt?: Date | null;
  replacedBy?: string | null;
}

const refreshTokenSchema = new Schema<RefreshTokenDoc>({
  tokenId: { type: String, required: true, unique: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  orgId: { type: Schema.Types.ObjectId, required: true, index: true },
  userAgent: { type: String, default: "" },
  ip: { type: String, default: "" },
  issuedAt: { type: Date, required: true, default: () => new Date() },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null },
  replacedBy: { type: String, default: null },
});

// TTL purge expired tokens — Mongo will drop the doc shortly after expiresAt.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken: Model<RefreshTokenDoc> =
  (mongoose.models.RefreshToken as Model<RefreshTokenDoc>) ||
  mongoose.model<RefreshTokenDoc>("RefreshToken", refreshTokenSchema);
