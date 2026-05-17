import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import type { Currency, Status } from "@sadiyakargo/shared";

interface Money {
  amount: number;
  currency: Currency;
}

interface Recipient {
  name: string;
  phone: string;
  addressTr: string;
}

interface ShipmentItem {
  _id: Types.ObjectId;
  lotId: Types.ObjectId;
  qty: number;
  senderCharge: Money | null;
}

interface StatusEvent {
  fromStatus: Status | null;
  toStatus: Status;
  changedBy: Types.ObjectId;
  changedAt: Date;
  comment: string;
}

export interface ShipmentDoc extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  shortCode: string;
  carrierId: Types.ObjectId;
  recipient: Recipient | null;
  shipmentDate: Date;
  carrierFee: Money;
  status: Status;
  items: ShipmentItem[];
  statusHistory: StatusEvent[];
  publicTrackingToken: string;
  notes: string;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  toClient(): {
    id: string;
    shortCode: string;
    carrierId: string;
    recipient: Recipient | null;
    shipmentDate: string;
    carrierFee: Money;
    status: Status;
    items: { id: string; lotId: string; qty: number; senderCharge: Money | null }[];
    statusHistory: {
      fromStatus: Status | null;
      toStatus: Status;
      changedBy: string;
      changedAt: string;
      comment: string;
    }[];
    publicTrackingToken: string;
    notes: string;
    createdAt: string;
    updatedAt: string;
  };
  toPublicJSON(): {
    shortCode: string;
    status: Status;
    shipmentDate: string;
    statusHistory: { toStatus: Status; changedAt: string }[];
    recipient: { name: string; phoneMasked: string; cityHint: string } | null;
    totalItems: number;
  };
}

const moneySchema = new Schema<Money>(
  {
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, enum: ["USD", "UZS", "TRY"] },
  },
  { _id: false }
);

const recipientSchema = new Schema<Recipient>(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    addressTr: { type: String, required: true },
  },
  { _id: false }
);

const itemSchema = new Schema<ShipmentItem>(
  {
    lotId: { type: Schema.Types.ObjectId, ref: "InboundLot", required: true },
    qty: { type: Number, required: true, min: 1 },
    senderCharge: { type: moneySchema, default: null },
  },
  { _id: true }
);

const statusEventSchema = new Schema<StatusEvent>(
  {
    fromStatus: { type: String, default: null },
    toStatus: { type: String, required: true },
    changedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    changedAt: { type: Date, default: () => new Date() },
    comment: { type: String, default: "" },
  },
  { _id: false }
);

const shipmentSchema = new Schema<ShipmentDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, required: true, index: true },
    shortCode: { type: String, required: true },
    carrierId: { type: Schema.Types.ObjectId, ref: "Carrier", required: true },
    recipient: { type: recipientSchema, default: null },
    shipmentDate: { type: Date, required: true, default: () => new Date() },
    carrierFee: { type: moneySchema, required: true },
    status: {
      type: String,
      enum: ["bekliyor", "yolda", "teslim", "kayip", "borclu", "iptal"],
      default: "bekliyor",
    },
    items: { type: [itemSchema], default: [] },
    statusHistory: { type: [statusEventSchema], default: [] },
    publicTrackingToken: { type: String, required: true },
    notes: { type: String, default: "" },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

shipmentSchema.index({ orgId: 1, carrierId: 1, status: 1 });
shipmentSchema.index({ orgId: 1, status: 1, shipmentDate: -1 });
shipmentSchema.index({ orgId: 1, shortCode: 1 }, { unique: true });
shipmentSchema.index({ publicTrackingToken: 1 }, { unique: true });
shipmentSchema.index({ "items.lotId": 1 });

shipmentSchema.methods.toClient = function toClient() {
  return {
    id: this._id.toString(),
    shortCode: this.shortCode,
    carrierId: this.carrierId.toString(),
    recipient: this.recipient,
    shipmentDate: this.shipmentDate.toISOString(),
    carrierFee: this.carrierFee,
    status: this.status,
    items: this.items.map((it: ShipmentItem) => ({
      id: it._id.toString(),
      lotId: it.lotId.toString(),
      qty: it.qty,
      senderCharge: it.senderCharge,
    })),
    statusHistory: this.statusHistory.map((e: StatusEvent) => ({
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      changedBy: e.changedBy.toString(),
      changedAt: e.changedAt.toISOString(),
      comment: e.comment,
    })),
    publicTrackingToken: this.publicTrackingToken,
    notes: this.notes,
    createdAt: this.createdAt.toISOString(),
    updatedAt: this.updatedAt.toISOString(),
  };
};

shipmentSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    shortCode: this.shortCode,
    status: this.status,
    shipmentDate: this.shipmentDate.toISOString(),
    statusHistory: this.statusHistory.map((e: StatusEvent) => ({
      toStatus: e.toStatus,
      changedAt: e.changedAt.toISOString(),
    })),
    recipient: this.recipient
      ? {
          name: this.recipient.name,
          phoneMasked: maskPhone(this.recipient.phone),
          cityHint: extractCityHint(this.recipient.addressTr),
        }
      : null,
    totalItems: this.items.reduce((sum: number, it: ShipmentItem) => sum + it.qty, 0),
  };
};

function maskPhone(phone: string): string {
  if (phone.length <= 4) return "***";
  return `***${phone.slice(-4)}`;
}

function extractCityHint(address: string): string {
  // Heuristic: first comma-separated chunk = city in most TR addresses.
  return (address.split(",")[0] || "").trim().slice(0, 60);
}

export const Shipment: Model<ShipmentDoc> =
  (mongoose.models.Shipment as Model<ShipmentDoc>) ||
  mongoose.model<ShipmentDoc>("Shipment", shipmentSchema);
