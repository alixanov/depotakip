import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import type {
  NotificationChannel,
  NotificationLanguage,
  NotificationTemplateKey,
} from "@sadiyakargo/shared";

export interface TemplateDoc extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  key: NotificationTemplateKey;
  channel: NotificationChannel;
  language: NotificationLanguage;
  body: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  toClient(): {
    id: string;
    key: NotificationTemplateKey;
    channel: NotificationChannel;
    language: NotificationLanguage;
    body: string;
    active: boolean;
  };
}

const schema = new Schema<TemplateDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, required: true, index: true },
    key: { type: String, required: true },
    channel: { type: String, required: true, enum: ["sms", "telegram"] },
    language: { type: String, required: true, enum: ["tr", "ru", "uz"] },
    body: { type: String, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "notificationTemplates" }
);

schema.index({ orgId: 1, key: 1, channel: 1, language: 1 }, { unique: true });

schema.methods.toClient = function toClient() {
  return {
    id: this._id.toString(),
    key: this.key,
    channel: this.channel,
    language: this.language,
    body: this.body,
    active: this.active,
  };
};

export const NotificationTemplate: Model<TemplateDoc> =
  (mongoose.models.NotificationTemplate as Model<TemplateDoc>) ||
  mongoose.model<TemplateDoc>("NotificationTemplate", schema);
