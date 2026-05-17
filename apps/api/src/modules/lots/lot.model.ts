import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import type { Currency, LotStatus } from "@sadiyakargo/shared";

interface PhotoRef {
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  uploadedAt: Date;
}

interface UnitPrice {
  amount: number;
  currency: Currency;
}

export interface LotDoc extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  senderId: Types.ObjectId;
  categoryId: Types.ObjectId;
  qtyIn: number;
  qtyAvailable: number;
  unitPrice: UnitPrice | null;
  receivedAt: Date;
  notes: string;
  status: LotStatus;
  photos: PhotoRef[];
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  toClient(): {
    id: string;
    senderId: string;
    categoryId: string;
    qtyIn: number;
    qtyAvailable: number;
    unitPrice: UnitPrice | null;
    receivedAt: string;
    notes: string;
    status: LotStatus;
    photos: { storageKey: string; mimeType: string; sizeBytes: number; uploadedAt: string }[];
    createdAt: string;
    updatedAt: string;
  };
}

const lotSchema = new Schema<LotDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: "Sender", required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    qtyIn: { type: Number, required: true, min: 1 },
    qtyAvailable: { type: Number, required: true, min: 0 },
    unitPrice: {
      type: new Schema(
        {
          amount: { type: Number, required: true, min: 0 },
          currency: { type: String, required: true, enum: ["USD", "UZS", "TRY"] },
        },
        { _id: false }
      ),
      default: null,
    },
    receivedAt: { type: Date, required: true, default: () => new Date() },
    notes: { type: String, default: "" },
    status: {
      type: String,
      enum: ["in_stock", "partially_shipped", "fully_shipped", "withdrawn"],
      default: "in_stock",
    },
    photos: {
      type: [
        new Schema(
          {
            storageKey: { type: String, required: true },
            mimeType: { type: String, required: true },
            sizeBytes: { type: Number, required: true },
            width: Number,
            height: Number,
            uploadedAt: { type: Date, default: () => new Date() },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

lotSchema.index({ orgId: 1, senderId: 1, status: 1 });
lotSchema.index({ orgId: 1, categoryId: 1, qtyAvailable: 1 });
lotSchema.index({ orgId: 1, receivedAt: -1 });

lotSchema.methods.toClient = function toClient() {
  return {
    id: this._id.toString(),
    senderId: this.senderId.toString(),
    categoryId: this.categoryId.toString(),
    qtyIn: this.qtyIn,
    qtyAvailable: this.qtyAvailable,
    unitPrice: this.unitPrice,
    receivedAt: this.receivedAt.toISOString(),
    notes: this.notes,
    status: this.status,
    photos: this.photos.map((p: PhotoRef) => ({
      storageKey: p.storageKey,
      mimeType: p.mimeType,
      sizeBytes: p.sizeBytes,
      uploadedAt: p.uploadedAt.toISOString(),
    })),
    createdAt: this.createdAt.toISOString(),
    updatedAt: this.updatedAt.toISOString(),
  };
};

export const InboundLot: Model<LotDoc> =
  (mongoose.models.InboundLot as Model<LotDoc>) || mongoose.model<LotDoc>("InboundLot", lotSchema);
