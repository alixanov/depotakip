import { z } from "zod";
import {
  CURRENCIES,
  PAYMENT_METHODS,
  TRANSACTION_KINDS,
  type TransactionKind,
} from "../constants.js";
import { objectIdSchema } from "./common.js";

/** Контракт kind ↔ direction. `adjustment` универсальна (может быть и debit, и
 *  credit — реверсы), у остальных — фиксированная семантика. */
const EXPECTED_DIRECTION: Record<TransactionKind, "debit" | "credit" | "both"> = {
  carrier_charge: "debit",
  sender_charge: "debit",
  carrier_payment: "credit",
  sender_payment: "credit",
  adjustment: "both",
};

/** Контракт kind ↔ counterparty.type — префикс kind определяет тип. */
const EXPECTED_PARTY: Record<TransactionKind, "carrier" | "sender" | "any"> = {
  carrier_charge: "carrier",
  carrier_payment: "carrier",
  sender_charge: "sender",
  sender_payment: "sender",
  adjustment: "any",
};

export const createTransactionSchema = z
  .object({
    kind: z.enum(TRANSACTION_KINDS),
    counterparty: z.object({
      type: z.enum(["carrier", "sender"]),
      id: objectIdSchema,
    }),
    shipmentId: objectIdSchema.nullable().optional(),
    amount: z.coerce.number().int().positive("validation:amount_positive"),
    currency: z.enum(CURRENCIES),
    direction: z.enum(["debit", "credit"]),
    txDate: z.string().date().optional(),
    method: z.enum(PAYMENT_METHODS).default("cash"),
    notes: z.string().trim().max(1000).default(""),
  })
  .refine(
    ({ kind, direction }) => {
      const expected = EXPECTED_DIRECTION[kind];
      return expected === "both" || expected === direction;
    },
    {
      message: "validation:tx_kind_direction_mismatch",
      path: ["direction"],
    }
  )
  .refine(
    ({ kind, counterparty }) => {
      const expected = EXPECTED_PARTY[kind];
      return expected === "any" || expected === counterparty.type;
    },
    {
      message: "validation:tx_kind_party_mismatch",
      path: ["counterparty", "type"],
    }
  );

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
