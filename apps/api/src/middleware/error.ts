import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
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

  const maybeMongo = err as MongoLikeError;
  if (maybeMongo && maybeMongo.code === 11000) {
    res.status(409).json({ error: "Kayıt zaten mevcut", code: "CONFLICT" });
    return;
  }

  res.status(500).json({ error: "Internal server error", code: "INTERNAL", requestId: req.id });
}
