import { z } from "zod";
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_LANGUAGES,
  NOTIFICATION_TEMPLATE_KEYS,
} from "../constants.js";

export const createTemplateSchema = z.object({
  key: z.enum(NOTIFICATION_TEMPLATE_KEYS),
  channel: z.enum(NOTIFICATION_CHANNELS),
  language: z.enum(NOTIFICATION_LANGUAGES),
  body: z.string().trim().min(1).max(5000),
  active: z.boolean().default(true),
});

export const updateTemplateSchema = createTemplateSchema.partial();

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
