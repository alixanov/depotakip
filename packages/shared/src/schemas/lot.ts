import { z } from "zod";
import { moneySchema, objectIdSchema } from "./common.js";

export const createLotSchema = z.object({
  senderId: objectIdSchema,
  label: z.string().trim().max(120).optional(),
  qtyIn: z.coerce.number().int().positive(),
  unitPrice: moneySchema.nullable().optional(),
  receivedAt: z.string().datetime().optional(),
  notes: z.string().trim().max(1000).default(""),
});

export const updateLotSchema = z.object({
  label: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1000).optional(),
});

/** PATCH /lots/:id/photos/order — must include every existing photoId exactly once. */
export const reorderPhotosSchema = z.object({
  photoIds: z.array(objectIdSchema).min(1).max(50),
});

export type CreateLotInput = z.infer<typeof createLotSchema>;
export type UpdateLotInput = z.infer<typeof updateLotSchema>;
export type ReorderPhotosInput = z.infer<typeof reorderPhotosSchema>;
