import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import type { Currency } from "@sadiyakargo/shared";

export interface ExchangeRateDoc extends Document {
  _id: Types.ObjectId;
  currency: Currency;
  rateToUsd: number;
  rateDate: Date;
  source: "manual" | "cbu";
  createdAt: Date;
  updatedAt: Date;
  toClient(): {
    id: string;
    currency: Currency;
    rateToUsd: number;
    rateDate: string;
    source: "manual" | "cbu";
  };
}

const exchangeRateSchema = new Schema<ExchangeRateDoc>(
  {
    currency: { type: String, required: true, enum: ["USD", "UZS", "TRY"] },
    rateToUsd: { type: Number, required: true, min: 0 },
    rateDate: { type: Date, required: true },
    source: { type: String, enum: ["manual", "cbu"], default: "manual" },
  },
  { timestamps: true }
);

exchangeRateSchema.index({ currency: 1, rateDate: -1 }, { unique: true });

exchangeRateSchema.methods.toClient = function toClient() {
  return {
    id: this._id.toString(),
    currency: this.currency,
    rateToUsd: this.rateToUsd,
    rateDate: this.rateDate.toISOString().slice(0, 10),
    source: this.source,
  };
};

export const ExchangeRate: Model<ExchangeRateDoc> =
  (mongoose.models.ExchangeRate as Model<ExchangeRateDoc>) ||
  mongoose.model<ExchangeRateDoc>("ExchangeRate", exchangeRateSchema);
