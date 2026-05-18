import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import multer from "multer";
import { AppError } from "../lib/errors.js";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

interface MongoLikeError {
  code?: number;
  message?: string;
}

/** Express 5 central error handler. The signature must keep 4 args. */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (env.NODE_ENV !== "test") {
    logger.error({ err, method: req.method, url: req.originalUrl }, "request_failed");
  }

  if (err instanceof AppError) {
    res.status(err.status).json({
      error: err.message,
      code: err.code,
      ...(err.details !== undefined ? { details: err.details } : {}),
    });
    return;
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const fields: Record<string, string> = {};
    for (const [key, value] of Object.entries(err.errors)) {
      fields[key] = value.message;
    }
    res.status(422).json({ error: "Doğrulama hatası", code: "VALIDATION", fields });
    return;
  }

  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({ error: "Geçersiz id", code: "BAD_REQUEST" });
    return;
  }

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      const mb = Math.round(env.LOT_PHOTO_MAX_BYTES / (1024 * 1024));
      res
        .status(413)
        .json({ error: `Dosya boyutu ${mb} MB sınırını aşıyor`, code: "FILE_TOO_LARGE" });
      return;
    }
    if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") {
      res.status(400).json({
        error: `En fazla ${env.LOT_PHOTO_MAX_COUNT} dosya yüklenebilir`,
        code: "TOO_MANY_FILES",
      });
      return;
    }
    res.status(400).json({ error: err.message, code: "UPLOAD_ERROR" });
    return;
  }

  // Custom signal from upload middleware fileFilter when the declared MIME
  // is not an image. The real magic-byte check still runs in the service.
  if (err instanceof Error && err.message === "UNSUPPORTED_MEDIA") {
    res
      .status(415)
      .json({ error: "Sadece resim dosyaları yüklenebilir", code: "UNSUPPORTED_MEDIA" });
    return;
  }

  const maybeMongo = err as MongoLikeError;
  if (maybeMongo && maybeMongo.code === 11000) {
    res.status(409).json({ error: "Kayıt zaten mevcut", code: "CONFLICT" });
    return;
  }

  res.status(500).json({ error: "Internal server error", code: "INTERNAL", requestId: req.id });
}
