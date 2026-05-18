import { z } from "zod";
import { optionalPhoneSchema, telegramUsernameSchema } from "./common.js";

export const createCarrierSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  // lastName опциональна: некоторые перевозчики представлены только по
  // имени (или прозвищу). Пустая строка → "" в БД, отображение собирает
  // "firstName lastName" с trim, так что пустое поле просто не покажется.
  lastName: z.string().trim().max(80).default(""),
  phone: optionalPhoneSchema,
  telegramChatId: z.number().int().nullable().optional(),
  telegramUsername: telegramUsernameSchema,
  deliveryAddressTr: z.string().trim().max(500).default(""),
  notes: z.string().trim().max(1000).default(""),
});

export const updateCarrierSchema = createCarrierSchema.partial();

export type CreateCarrierInput = z.infer<typeof createCarrierSchema>;
export type UpdateCarrierInput = z.infer<typeof updateCarrierSchema>;
