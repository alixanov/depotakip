import { z } from "zod";
import { CURRENCIES, PAYMENT_METHODS, TRANSACTION_KINDS } from "../constants.js";
import { objectIdSchema } from "./common.js";

export const createTransactionSchema = z.object({
  kind: z.enum(TRANSACTION_KINDS),
  counterparty: z.object({
    type: z.enum(["carrier", "sender"]),
    id: objectIdSchema,
  }),
  shipmentId: objectIdSchema.nullable().optional(),
  amount: z.coerce.number().int().positive("Tutar > 0 olmalı"),
  currency: z.enum(CURRENCIES),
  direction: z.enum(["debit", "credit"]),
  txDate: z.string().date().optional(),
  method: z.enum(PAYMENT_METHODS).default("cash"),
  notes: z.string().trim().max(1000).default(""),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
