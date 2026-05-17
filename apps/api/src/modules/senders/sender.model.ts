import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export interface SenderDoc extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  fullName: string;
  phone: string;
  telegramChatId: number | null;
  address: string;
  notes: string;
  isSelf: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  toClient(): {
    id: string;
    fullName: string;
    phone: string;
    telegramChatId: number | null;
    address: string;
    notes: string;
    isSelf: boolean;
    createdAt: string;
    updatedAt: string;
  };
}

const senderSchema = new Schema<SenderDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, required: true, index: true },
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    telegramChatId: { type: Number, default: null },
    address: { type: String, default: "", trim: true },
    notes: { type: String, default: "", trim: true },
    isSelf: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

senderSchema.index({ orgId: 1, phone: 1 });

senderSchema.methods.toClient = function toClient() {
  return {
    id: this._id.toString(),
    fullName: this.fullName,
    phone: this.phone,
    telegramChatId: this.telegramChatId,
    address: this.address,
    notes: this.notes,
    isSelf: this.isSelf,
    createdAt: this.createdAt.toISOString(),
    updatedAt: this.updatedAt.toISOString(),
  };
};

export const Sender: Model<SenderDoc> =
  (mongoose.models.Sender as Model<SenderDoc>) || mongoose.model<SenderDoc>("Sender", senderSchema);
