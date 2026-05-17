import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "login"
  | "logout"
  | "export"
  | "status_change";

export interface AuditLogDoc extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  userId: Types.ObjectId | null;
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  diff: { before?: unknown; after?: unknown } | null;
  ip: string;
  userAgent: string;
  at: Date;
  toClient(): {
    id: string;
    userId: string | null;
    action: AuditAction;
    entityType: string;
    entityId: string | null;
    diff: { before?: unknown; after?: unknown } | null;
    ip: string;
    userAgent: string;
    at: string;
  };
}

const schema = new Schema<AuditLogDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    action: {
      type: String,
      required: true,
      enum: ["create", "update", "delete", "login", "logout", "export", "status_change"],
    },
    entityType: { type: String, required: true },
    entityId: { type: String, default: null },
    diff: { type: Schema.Types.Mixed, default: null },
    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    at: { type: Date, default: () => new Date() },
  },
  { collection: "auditLog" }
);

schema.index({ orgId: 1, at: -1 });
schema.index({ entityType: 1, entityId: 1 });
schema.index({ at: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 365 * 2 });

schema.methods.toClient = function toClient() {
  return {
    id: this._id.toString(),
    userId: this.userId ? this.userId.toString() : null,
    action: this.action,
    entityType: this.entityType,
    entityId: this.entityId,
    diff: this.diff,
    ip: this.ip,
    userAgent: this.userAgent,
    at: this.at.toISOString(),
  };
};

export const AuditLog: Model<AuditLogDoc> =
  (mongoose.models.AuditLog as Model<AuditLogDoc>) ||
  mongoose.model<AuditLogDoc>("AuditLog", schema);
