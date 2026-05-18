import { z } from "zod";
import { CURRENCIES } from "../constants.js";

export const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, "Geçersiz id formatı");

export const idParamSchema = z.object({ id: objectIdSchema });

export const lotPhotoIdParamSchema = z.object({
  id: objectIdSchema,
  photoId: objectIdSchema,
});

export const moneySchema = z.object({
  amount: z.number().int().nonnegative(),
  currency: z.enum(CURRENCIES),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sort: z.string().optional(),
});

export const dateRangeQuerySchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[\d\s\-()]{5,40}$/, "Geçersiz telefon");
