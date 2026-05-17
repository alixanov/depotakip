import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import type { NotificationChannel, NotificationTemplateKey } from "@sadiyakargo/shared";

export type LogStatus = "queued" | "sent" | "failed";

export interface NotificationLogDoc extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  channel: NotificationChannel;
  recipientType: "sender" | "carrier" | "recipient";
  recipientRef: {
    id: Types.ObjectId | null;
    phone: string | null;
    chatId: number | null;
  };
  templateKey: NotificationTemplateKey;
  payload: Record<string, unknown>;
  renderedText: string;
  status: LogStatus;
  attempts: number;
  providerResponse?: Record<string, unknown>;
  sentAt?: Date | null;
  errorMessage?: string | null;
  createdAt: Date;
  updatedAt: Date;
  toClient(): {
    id: string;
    channel: NotificationChannel;
    recipientType: "sender" | "carrier" | "recipient";
    templateKey: NotificationTemplateKey;
    renderedText: string;
    status: LogStatus;
    attempts: number;
    sentAt: string | null;
    errorMessage: string | null;
    createdAt: string;
  };
}

const schema = new Schema<NotificationLogDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, required: true, index: true },
    channel: { type: String, required: true, enum: ["sms", "telegram"] },
    recipientType: { type: String, required: true, enum: ["sender", "carrier", "recipient"] },
    recipientRef: {
      id: { type: Schema.Types.ObjectId, default: null },
      phone: { type: String, default: null },
      chatId: { type: Number, default: null },
    },
    templateKey: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, default: {} },
    renderedText: { type: String, required: true },
    status: { type: String, enum: ["queued", "sent", "failed"], default: "queued" },
    attempts: { type: Number, default: 0 },
    providerResponse: { type: Schema.Types.Mixed },
    sentAt: { type: Date, default: null },
    errorMessage: { type: String, default: null },
  },
  { timestamps: true, collection: "notificationLog" }
);

schema.index({ orgId: 1, status: 1, createdAt: -1 });
schema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 365 });

schema.methods.toClient = function toClient() {
  return {
    id: this._id.toString(),
    channel: this.channel,
    recipientType: this.recipientType,
    templateKey: this.templateKey,
    renderedText: this.renderedText,
    status: this.status,
    attempts: this.attempts,
    sentAt: this.sentAt ? this.sentAt.toISOString() : null,
    errorMessage: this.errorMessage || null,
    createdAt: this.createdAt.toISOString(),
  };
};

export const NotificationLog: Model<NotificationLogDoc> =
  (mongoose.models.NotificationLog as Model<NotificationLogDoc>) ||
  mongoose.model<NotificationLogDoc>("NotificationLog", schema);
