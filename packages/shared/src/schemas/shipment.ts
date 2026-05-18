import { z } from "zod";
import { STATUSES } from "../constants.js";
import { objectIdSchema, phoneSchema, positiveMoneySchema } from "./common.js";

export const recipientSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: phoneSchema,
  addressTr: z.string().trim().min(1).max(500),
});

export const shipmentItemSchema = z.object({
  lotId: objectIdSchema,
  qty: z.coerce.number().int().positive(),
  // senderCharge: либо null (нет начисления отправителю), либо positive money.
  // Нулевой charge не имеет смысла и упирается в Transaction.amount min:1.
  senderCharge: positiveMoneySchema.nullable().optional(),
});

export const createShipmentSchema = z.object({
  carrierId: objectIdSchema,
  recipient: recipientSchema.nullable().optional(),
  shipmentDate: z.string().date().optional(),
  // carrierFee всегда > 0 — бесплатной отгрузки не бывает.
  carrierFee: positiveMoneySchema,
  items: z.array(shipmentItemSchema).min(1, "validation:shipment_items_min1"),
  notes: z.string().trim().max(1000).default(""),
});

export const updateShipmentStatusSchema = z.object({
  status: z.enum(STATUSES),
  comment: z.string().trim().max(500).optional(),
});

export type CreateShipmentInput = z.infer<typeof createShipmentSchema>;
export type UpdateShipmentStatusInput = z.infer<typeof updateShipmentStatusSchema>;
export type RecipientInput = z.infer<typeof recipientSchema>;
