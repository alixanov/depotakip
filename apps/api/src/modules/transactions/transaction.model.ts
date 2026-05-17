import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import type { Currency, PaymentMethod, TransactionKind } from "@sadiyakargo/shared";

export interface TransactionDoc extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  kind: TransactionKind;
  counterparty: {
    type: "carrier" | "sender";
    id: Types.ObjectId;
  };
  shipmentId: Types.ObjectId | null;
  amount: number; // minor units
  currency: Currency;
  direction: "debit" | "credit";
  txDate: Date;
  exchangeRateToUsd: number;
  amountUsdSnapshot: number; // USD-cents
  method: PaymentMethod;
  notes: string;
  reversesTransactionId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
  toClient(): {
    id: string;
    kind: TransactionKind;
    counterparty: { type: "carrier" | "sender"; id: string };
    shipmentId: string | null;
    amount: number;
    currency: Currency;
    direction: "debit" | "credit";
    txDate: string;
    exchangeRateToUsd: number;
    amountUsdSnapshot: number;
    method: PaymentMethod;
    notes: string;
    reversesTransactionId: string | null;
    createdAt: string;
  };
}

const transactionSchema = new Schema<TransactionDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, required: true, index: true },
    kind: {
      type: String,
      required: true,
      enum: ["carrier_charge", "carrier_payment", "sender_charge", "sender_payment", "adjustment"],
    },
    counterparty: {
      type: { type: String, required: true, enum: ["carrier", "sender"] },
      id: { type: Schema.Types.ObjectId, required: true },
    },
    shipmentId: { type: Schema.Types.ObjectId, ref: "Shipment", default: null },
    amount: { type: Number, required: true, min: 1 },
    currency: { type: String, required: true, enum: ["USD", "UZS", "TRY"] },
    direction: { type: String, required: true, enum: ["debit", "credit"] },
    txDate: { type: Date, required: true, default: () => new Date() },
    exchangeRateToUsd: { type: Number, required: true, default: 1 },
    amountUsdSnapshot: { type: Number, required: true },
    method: {
      type: String,
      required: true,
      enum: ["cash", "bank", "card", "other"],
      default: "cash",
    },
    notes: { type: String, default: "" },
    reversesTransactionId: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

transactionSchema.index({
  orgId: 1,
  "counterparty.type": 1,
  "counterparty.id": 1,
  txDate: -1,
});
transactionSchema.index({ orgId: 1, shipmentId: 1 });
transactionSchema.index({ orgId: 1, txDate: -1 });

transactionSchema.methods.toClient = function toClient() {
  return {
    id: this._id.toString(),
    kind: this.kind,
    counterparty: { type: this.counterparty.type, id: this.counterparty.id.toString() },
    shipmentId: this.shipmentId ? this.shipmentId.toString() : null,
    amount: this.amount,
    currency: this.currency,
    direction: this.direction,
    txDate: this.txDate.toISOString(),
    exchangeRateToUsd: this.exchangeRateToUsd,
    amountUsdSnapshot: this.amountUsdSnapshot,
    method: this.method,
    notes: this.notes,
    reversesTransactionId: this.reversesTransactionId
      ? this.reversesTransactionId.toString()
      : null,
    createdAt: this.createdAt.toISOString(),
  };
};

export const Transaction: Model<TransactionDoc> =
  (mongoose.models.Transaction as Model<TransactionDoc>) ||
  mongoose.model<TransactionDoc>("Transaction", transactionSchema);
