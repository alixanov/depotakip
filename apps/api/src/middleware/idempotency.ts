import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import type { NextFunction, Request, Response } from "express";

interface IdempotencyKeyDoc extends Document {
  _id: Types.ObjectId;
  key: string;
  userId: Types.ObjectId;
  method: string;
  path: string;
  responseStatus: number;
  responseBody: unknown;
  createdAt: Date;
}

const schema = new Schema<IdempotencyKeyDoc>({
  key: { type: String, required: true },
  userId: { type: Schema.Types.ObjectId, required: true },
  method: { type: String, required: true },
  path: { type: String, required: true },
  responseStatus: { type: Number, required: true },
  responseBody: { type: Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: () => new Date() },
});

schema.index({ key: 1, userId: 1 }, { unique: true });
schema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 });

export const IdempotencyKey: Model<IdempotencyKeyDoc> =
  (mongoose.models.IdempotencyKey as Model<IdempotencyKeyDoc>) ||
  mongoose.model<IdempotencyKeyDoc>("IdempotencyKey", schema);

/**
 * If the request carries an `Idempotency-Key` header and we've already
 * answered this same key for this user, replay the original response. Otherwise
 * monkey-patch `res.json` to persist the response on success (2xx).
 */
export function idempotency(req: Request, res: Response, next: NextFunction): void {
  const headerVal = req.get("Idempotency-Key");
  if (!headerVal || !req.userId) return next();

  IdempotencyKey.findOne({ key: headerVal, userId: req.userId })
    .then((existing) => {
      if (existing) {
        res.status(existing.responseStatus).json(existing.responseBody);
        return;
      }

      const originalJson = res.json.bind(res);
      res.json = function patchedJson(body: unknown): Response {
        if (res.statusCode >= 200 && res.statusCode < 300 && req.userId) {
          IdempotencyKey.create({
            key: headerVal,
            userId: req.userId,
            method: req.method,
            path: req.originalUrl,
            responseStatus: res.statusCode,
            responseBody: body,
          }).catch(() => undefined);
        }
        return originalJson(body);
      };
      next();
    })
    .catch(next);
}
