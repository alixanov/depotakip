import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export interface CarrierDoc extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  firstName: string;
  lastName: string;
  phone: string;
  telegramChatId: number | null;
  deliveryAddressTr: string;
  notes: string;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  toClient(): {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    telegramChatId: number | null;
    deliveryAddressTr: string;
    notes: string;
    createdAt: string;
    updatedAt: string;
  };
}

const carrierSchema = new Schema<CarrierDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, required: true, index: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    telegramChatId: { type: Number, default: null },
    deliveryAddressTr: { type: String, default: "", trim: true },
    notes: { type: String, default: "", trim: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

carrierSchema.index({ orgId: 1, phone: 1 });

carrierSchema.methods.toClient = function toClient() {
  return {
    id: this._id.toString(),
    firstName: this.firstName,
    lastName: this.lastName,
    phone: this.phone,
    telegramChatId: this.telegramChatId,
    deliveryAddressTr: this.deliveryAddressTr,
    notes: this.notes,
    createdAt: this.createdAt.toISOString(),
    updatedAt: this.updatedAt.toISOString(),
  };
};

export const Carrier: Model<CarrierDoc> =
  (mongoose.models.Carrier as Model<CarrierDoc>) ||
  mongoose.model<CarrierDoc>("Carrier", carrierSchema);
