import { Types, type ClientSession } from "mongoose";
import type { CreateTransactionInput, Currency, TransactionKind } from "@depotakip/shared";
import { badRequest, notFound } from "../../lib/errors.js";
import { paginate, tenantFilter } from "../../lib/repository.js";
import { Carrier } from "../carriers/carrier.model.js";
import { Sender } from "../senders/sender.model.js";
import { convertToUsd } from "../exchangeRates/exchangeRates.service.js";
import { enqueue as enqueueNotification } from "../notifications/notifications.service.js";
import { Transaction } from "./transaction.model.js";

interface ListQuery {
  page?: number;
  limit?: number;
  counterpartyType?: "carrier" | "sender";
  counterpartyId?: string;
  shipmentId?: string;
  kind?: TransactionKind;
  from?: string;
  to?: string;
  sort?: string;
}

export async function list(orgId: string, query: ListQuery) {
  const filter = tenantFilter(orgId);
  if (query.counterpartyType)
    Object.assign(filter, { "counterparty.type": query.counterpartyType });
  if (query.counterpartyId)
    Object.assign(filter, { "counterparty.id": new Types.ObjectId(query.counterpartyId) });
  if (query.shipmentId) Object.assign(filter, { shipmentId: new Types.ObjectId(query.shipmentId) });
  if (query.kind) Object.assign(filter, { kind: query.kind });
  if (query.from || query.to) {
    const range: Record<string, Date> = {};
    if (query.from) range.$gte = new Date(query.from);
    if (query.to) range.$lte = new Date(query.to);
    Object.assign(filter, { txDate: range });
  }
  return paginate(Transaction, filter, query, (d) => d.toClient(), { txDate: -1 });
}

export async function get(orgId: string, id: string) {
  const doc = await Transaction.findOne(tenantFilter(orgId, { _id: new Types.ObjectId(id) }));
  if (!doc) throw notFound("Tx bulunamadı");
  return doc.toClient();
}

/**
 * Insert a single transaction with currency snapshot. When called from a
 * shipment transaction, pass `session` so the write is rolled back together.
 */
export async function createTx(
  orgId: string,
  args: {
    kind: TransactionKind;
    counterparty: { type: "carrier" | "sender"; id: string };
    shipmentId?: string | null;
    amount: number;
    currency: Currency;
    direction: "debit" | "credit";
    txDate?: Date;
    method?: "cash" | "bank" | "card" | "other";
    notes?: string;
    reversesTransactionId?: string | null;
  },
  session?: ClientSession
) {
  const txDate = args.txDate ?? new Date();
  const { rate, amountUsd } = await convertToUsd(args.amount, args.currency, txDate);

  const [doc] = await Transaction.create(
    [
      {
        orgId: new Types.ObjectId(orgId),
        kind: args.kind,
        counterparty: {
          type: args.counterparty.type,
          id: new Types.ObjectId(args.counterparty.id),
        },
        shipmentId: args.shipmentId ? new Types.ObjectId(args.shipmentId) : null,
        amount: args.amount,
        currency: args.currency,
        direction: args.direction,
        txDate,
        exchangeRateToUsd: rate,
        amountUsdSnapshot: amountUsd,
        method: args.method ?? "cash",
        notes: args.notes ?? "",
        reversesTransactionId: args.reversesTransactionId
          ? new Types.ObjectId(args.reversesTransactionId)
          : null,
      },
    ],
    { session }
  );
  return doc;
}

/**
 * Public payment endpoint — operator/admin registers a payment from a
 * counterparty. Kind must be `*_payment` (credit) or `adjustment`.
 */
export async function registerPayment(orgId: string, input: CreateTransactionInput) {
  // Verify the counterparty exists in this org.
  if (input.counterparty.type === "carrier") {
    const c = await Carrier.findOne(
      tenantFilter(orgId, { _id: new Types.ObjectId(input.counterparty.id) })
    );
    if (!c) throw badRequest("Karşı taraf bulunamadı");
  } else {
    const s = await Sender.findOne(
      tenantFilter(orgId, { _id: new Types.ObjectId(input.counterparty.id) })
    );
    if (!s) throw badRequest("Karşı taraf bulunamadı");
  }

  const doc = await createTx(orgId, {
    kind: input.kind,
    counterparty: input.counterparty,
    shipmentId: input.shipmentId ?? null,
    amount: input.amount,
    currency: input.currency,
    direction: input.direction,
    txDate: input.txDate ? new Date(input.txDate) : undefined,
    method: input.method,
    notes: input.notes,
  });

  // Trigger payment_received notification when the counterparty paid us.
  if (input.kind === "carrier_payment" || input.kind === "sender_payment") {
    const chatId =
      input.counterparty.type === "carrier"
        ? (await Carrier.findById(input.counterparty.id))?.telegramChatId
        : (await Sender.findById(input.counterparty.id))?.telegramChatId;
    if (chatId) {
      await enqueueNotification({
        orgId,
        templateKey: "payment_received",
        recipient: {
          type: input.counterparty.type,
          id: input.counterparty.id,
          chatId,
        },
        vars: {
          amount: (input.amount / 100).toFixed(2),
          currency: input.currency,
        },
      });
    }
  }

  return doc.toClient();
}

interface BalanceRow {
  counterpartyId: string;
  name: string;
  debitUsd: number;
  creditUsd: number;
  balanceUsd: number;
}

async function balanceAggregation(
  orgId: string,
  type: "carrier" | "sender"
): Promise<BalanceRow[]> {
  const lookupCollection = type === "carrier" ? "carriers" : "senders";
  const rows = await Transaction.aggregate<{
    _id: Types.ObjectId;
    debitUsd: number;
    creditUsd: number;
    name?: string;
  }>([
    { $match: { ...tenantFilter(orgId), "counterparty.type": type } },
    {
      $group: {
        _id: "$counterparty.id",
        debitUsd: {
          $sum: { $cond: [{ $eq: ["$direction", "debit"] }, "$amountUsdSnapshot", 0] },
        },
        creditUsd: {
          $sum: { $cond: [{ $eq: ["$direction", "credit"] }, "$amountUsdSnapshot", 0] },
        },
      },
    },
    {
      $lookup: {
        from: lookupCollection,
        localField: "_id",
        foreignField: "_id",
        as: "party",
      },
    },
    {
      $project: {
        _id: 1,
        debitUsd: 1,
        creditUsd: 1,
        name:
          type === "carrier"
            ? {
                $concat: [
                  { $ifNull: [{ $arrayElemAt: ["$party.firstName", 0] }, ""] },
                  " ",
                  { $ifNull: [{ $arrayElemAt: ["$party.lastName", 0] }, ""] },
                ],
              }
            : { $arrayElemAt: ["$party.fullName", 0] },
      },
    },
  ]);

  return rows.map((r) => ({
    counterpartyId: r._id.toString(),
    name: (r.name || "—").trim(),
    debitUsd: r.debitUsd,
    creditUsd: r.creditUsd,
    balanceUsd: r.debitUsd - r.creditUsd,
  }));
}

export const carrierBalances = (orgId: string) => balanceAggregation(orgId, "carrier");
export const senderBalances = (orgId: string) => balanceAggregation(orgId, "sender");
