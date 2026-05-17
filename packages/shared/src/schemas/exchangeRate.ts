import { z } from "zod";
import { CURRENCIES } from "../constants.js";

export const createExchangeRateSchema = z.object({
  currency: z.enum(CURRENCIES).refine((c) => c !== "USD", { message: "USD baz para birimi" }),
  rateToUsd: z.number().positive(),
  rateDate: z.string().date(),
});

export type CreateExchangeRateInput = z.infer<typeof createExchangeRateSchema>;
