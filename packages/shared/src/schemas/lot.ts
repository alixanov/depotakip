import { z } from "zod";
import { moneySchema, objectIdSchema } from "./common.js";

export const createLotSchema = z.object({
  senderId: objectIdSchema,
  categoryId: objectIdSchema,
  qtyIn: z.coerce.number().int().positive(),
  unitPrice: moneySchema.nullable().optional(),
  receivedAt: z.string().datetime().optional(),
  notes: z.string().trim().max(1000).default(""),
});

export const updateLotSchema = z.object({
  notes: z.string().trim().max(1000).optional(),
});

export type CreateLotInput = z.infer<typeof createLotSchema>;
export type UpdateLotInput = z.infer<typeof updateLotSchema>;
