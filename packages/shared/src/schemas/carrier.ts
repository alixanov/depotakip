import { z } from "zod";
import { phoneSchema } from "./common.js";

export const createCarrierSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  phone: phoneSchema,
  telegramChatId: z.number().int().nullable().optional(),
  deliveryAddressTr: z.string().trim().max(500).default(""),
  notes: z.string().trim().max(1000).default(""),
});

export const updateCarrierSchema = createCarrierSchema.partial();

export type CreateCarrierInput = z.infer<typeof createCarrierSchema>;
export type UpdateCarrierInput = z.infer<typeof updateCarrierSchema>;
