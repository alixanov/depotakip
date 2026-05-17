import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export interface CategoryDoc extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  name: string;
  icon: string;
  sortOrder: number;
  active: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  toClient(): {
    id: string;
    name: string;
    icon: string;
    sortOrder: number;
    active: boolean;
  };
}

const categorySchema = new Schema<CategoryDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true, trim: true },
    icon: { type: String, default: "" },
    sortOrder: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

categorySchema.index(
  { orgId: 1, name: 1 },
  { unique: true, collation: { locale: "tr", strength: 2 } }
);

categorySchema.methods.toClient = function toClient() {
  return {
    id: this._id.toString(),
    name: this.name,
    icon: this.icon,
    sortOrder: this.sortOrder,
    active: this.active,
  };
};

export const Category: Model<CategoryDoc> =
  (mongoose.models.Category as Model<CategoryDoc>) ||
  mongoose.model<CategoryDoc>("Category", categorySchema);
