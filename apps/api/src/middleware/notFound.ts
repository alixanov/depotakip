import type { NextFunction, Request, Response } from "express";
import { notFound } from "../lib/errors.js";

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(notFound("err:route_not_found", { method: req.method, url: req.originalUrl }));
}
