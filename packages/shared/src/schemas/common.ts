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

/**
 * Telegram username. Accepts both `username` and `@username`; strips the
 * leading `@` and validates against the Telegram spec (5–32 chars, starts
 * with a letter, alphanum + underscore). Empty string is coerced to null so
 * a form input that the operator cleared serialises cleanly.
 *
 * NOTE: this is a display/lookup value only — the Telegram Bot API cannot
 * send messages to a private user by `@username`, only by numeric chatId.
 * Keep `telegramChatId` alongside for actual outbound delivery.
 */
export const telegramUsernameSchema = z.preprocess(
  (v) => {
    if (typeof v !== "string") return v;
    const stripped = v.trim().replace(/^@+/, "");
    return stripped === "" ? null : stripped;
  },
  z
    .string()
    .regex(
      /^[a-zA-Z][a-zA-Z0-9_]{4,31}$/,
      "5–32 karakter, harfle başlar, sadece harf/rakam/alt çizgi"
    )
    .nullable()
    .optional()
);
