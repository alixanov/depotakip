import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export interface PasswordResetTokenDoc extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  usedAt?: Date | null;
  createdAt: Date;
}

const schema = new Schema<PasswordResetTokenDoc>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date, default: null },
  createdAt: { type: Date, default: () => new Date() },
});

schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PasswordResetToken: Model<PasswordResetTokenDoc> =
  (mongoose.models.PasswordResetToken as Model<PasswordResetTokenDoc>) ||
  mongoose.model<PasswordResetTokenDoc>("PasswordResetToken", schema);
