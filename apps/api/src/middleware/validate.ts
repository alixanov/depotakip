import type { NextFunction, Request, Response } from "express";
import { ZodError, type ZodTypeAny } from "zod";
import { validation } from "../lib/errors.js";

interface ValidationSchemas {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
}

export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body ?? {});
      if (schemas.params) Object.assign(req.params, schemas.params.parse(req.params ?? {}));
      if (schemas.query) Object.assign(req.query, schemas.query.parse(req.query ?? {}));
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        }));
        next(validation(details[0]?.message || "Geçersiz istek", details));
        return;
      }
      next(err);
    }
  };
}
