import { z } from "zod";
import { phoneSchema, telegramUsernameSchema } from "./common.js";

export const createSenderSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  phone: phoneSchema,
  telegramChatId: z.number().int().nullable().optional(),
  telegramUsername: telegramUsernameSchema,
  address: z.string().trim().max(500).default(""),
  notes: z.string().trim().max(1000).default(""),
  isSelf: z.boolean().default(false),
});

export const updateSenderSchema = createSenderSchema.partial();

export type CreateSenderInput = z.infer<typeof createSenderSchema>;
export type UpdateSenderInput = z.infer<typeof updateSenderSchema>;
