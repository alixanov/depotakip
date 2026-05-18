import { randomBytes } from "node:crypto";
import mongoose, { Types } from "mongoose";
import type { CreateShipmentInput, Status } from "@sadiyakargo/shared";
import { env } from "../../config/env.js";
import { badRequest, conflict, notFound } from "../../lib/errors.js";
import { paginate, tenantFilter } from "../../lib/repository.js";
import { Carrier } from "../carriers/carrier.model.js";
import { InboundLot } from "../lots/lot.model.js";
import { Counter, nextSequence } from "./counter.model.js";
import { Shipment } from "./shipment.model.js";
import { emitOrgEvent } from "../../lib/realtime.js";
import { createTx } from "../transactions/transactions.service.js";
import { Transaction } from "../transactions/transaction.model.js";
import { enqueue as enqueueNotification } from "../notifications/notifications.service.js";
import { Sender } from "../senders/sender.model.js";

interface ListQuery {
  page?: number;
  limit?: number;
  status?: Status;
  /** "Needs attention" preset: borclu | kayip | bekliyor overdue ≥3d. Overrides `status`. */
  attention?: boolean;
  carrierId?: string;
  from?: string;
  to?: string;
  q?: string;
  sort?: string;
}

const ATTENTION_THRESHOLD_DAYS = 3;

export async function list(orgId: string, query: ListQuery) {
  const filter = tenantFilter(orgId);
  if (query.attention) {
    const cutoff = new Date(Date.now() - ATTENTION_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);
    Object.assign(filter, {
      $or: [
        { status: "borclu" },
        { status: "kayip" },
        { status: "bekliyor", shipmentDate: { $lt: cutoff } },
      ],
    });
  } else if (query.status) {
    Object.assign(filter, { status: query.status });
  }
  if (query.carrierId) Object.assign(filter, { carrierId: new Types.ObjectId(query.carrierId) });
  if (query.from || query.to) {
    const range: Record<string, Date> = {};
    if (query.from) range.$gte = new Date(query.from);
    if (query.to) range.$lte = new Date(query.to);
    Object.assign(filter, { shipmentDate: range });
  }
  if (query.q) {
    Object.assign(filter, { shortCode: { $regex: query.q, $options: "i" } });
  }
  return paginate(Shipment, filter, query, (d) => d.toClient(), { shipmentDate: -1 });
}

export async function get(orgId: string, id: string) {
  const doc = await Shipment.findOne(tenantFilter(orgId, { _id: new Types.ObjectId(id) }));
  if (!doc) throw notFound("Gönderi bulunamadı");
  return doc.toClient();
}

/**
 * Atomic shipment creation. In one MongoDB transaction we:
 * 1. lock-and-decrement `qtyAvailable` for every referenced lot (with the
 *    `qtyAvailable >= qty` guard — failure throws 409),
 * 2. flip the lot status to `partially_shipped` / `fully_shipped` accordingly,
 * 3. mint a sequential `shortCode` via the `counters` collection,
 * 4. insert the shipment with an initial `bekliyor` status event.
 *
 * Requires a replica-set MongoDB (docker-compose ships rs0 for dev).
 */
export async function create(orgId: string, userId: string, input: CreateShipmentInput) {
  const carrier = await Carrier.findOne(
    tenantFilter(orgId, { _id: new Types.ObjectId(input.carrierId) })
  );
  if (!carrier) throw badRequest("Kargocu bulunamadı");

  const session = await mongoose.startSession();
  try {
    let created;
    await session.withTransaction(async () => {
      // 1. lock-and-decrement every lot AND capture senderId for step 4.
      // Building the lotSenderMap from the decrement result is critical:
      // a second findById without tenantFilter+deletedAt would let a forged
      // or soft-deleted lotId silently bypass sender_charge generation
      // (the lookup returns null → "if (!senderId) continue" swallows the
      // money). Sourcing from `updated` reuses the org/deletedAt invariants
      // already enforced here.
      const lotSenderMap = new Map<string, string>();
      for (const item of input.items) {
        const lotId = new Types.ObjectId(item.lotId);
        const updated = await InboundLot.findOneAndUpdate(
          {
            _id: lotId,
            orgId: new Types.ObjectId(orgId),
            deletedAt: null,
            qtyAvailable: { $gte: item.qty },
          },
          { $inc: { qtyAvailable: -item.qty } },
          { new: true, session }
        );
        if (!updated) {
          throw conflict(`Yetersiz stok: parti ${item.lotId} (istenen ${item.qty})`);
        }
        lotSenderMap.set(item.lotId, updated.senderId.toString());
        const newStatus = updated.qtyAvailable === 0 ? "fully_shipped" : "partially_shipped";
        await InboundLot.updateOne({ _id: lotId }, { $set: { status: newStatus } }, { session });
      }

      // 2. mint shortCode
      const year = new Date().getFullYear();
      const seq = await nextSequence(`shipment_${year}`, session);
      const shortCode = `SH-${year}-${String(seq).padStart(5, "0")}`;

      // 3. insert shipment + auto-generated financial transactions below.

      const [doc] = await Shipment.create(
        [
          {
            orgId: new Types.ObjectId(orgId),
            shortCode,
            carrierId: carrier._id,
            recipient: input.recipient ?? null,
            shipmentDate: input.shipmentDate ? new Date(input.shipmentDate) : new Date(),
            carrierFee: input.carrierFee,
            items: input.items.map((it) => ({
              lotId: new Types.ObjectId(it.lotId),
              qty: it.qty,
              senderCharge: it.senderCharge ?? null,
            })),
            status: "bekliyor",
            statusHistory: [
              {
                fromStatus: null,
                toStatus: "bekliyor",
                changedBy: new Types.ObjectId(userId),
                changedAt: new Date(),
                comment: "Oluşturuldu",
              },
            ],
            publicTrackingToken: randomBytes(20).toString("hex"),
            notes: input.notes ?? "",
          },
        ],
        { session }
      );
      created = doc;

      // 4. financial side-effects (carrier_charge + per-item sender_charge)
      const shipmentId = doc._id.toString();
      await createTx(
        orgId,
        {
          kind: "carrier_charge",
          counterparty: { type: "carrier", id: carrier._id.toString() },
          shipmentId,
          amount: input.carrierFee.amount,
          currency: input.carrierFee.currency,
          direction: "debit",
          notes: `Sevkiyat ${doc.shortCode}`,
        },
        session
      );
      for (const item of input.items) {
        if (!item.senderCharge) continue;
        const senderId = lotSenderMap.get(item.lotId);
        if (!senderId) {
          // Defensive: step 1 populated the map for every item — a miss here
          // is a code-path bug, not user input. Throwing aborts the
          // transaction (qtyAvailable rollbacks) instead of swallowing.
          throw new Error(`lotSenderMap missing entry for lot ${item.lotId}`);
        }
        await createTx(
          orgId,
          {
            kind: "sender_charge",
            counterparty: { type: "sender", id: senderId },
            shipmentId,
            amount: item.senderCharge.amount,
            currency: item.senderCharge.currency,
            direction: "debit",
            notes: `Sevkiyat ${doc.shortCode}`,
          },
          session
        );
      }
    });

    if (!created) throw new Error("transaction did not produce a shipment");

    const json = (created as InstanceType<typeof Shipment>).toClient();
    emitOrgEvent(orgId, "shipment:created", json);
    return json;
  } finally {
    await session.endSession();
  }
}

export async function updateStatus(
  orgId: string,
  userId: string,
  id: string,
  toStatus: Status,
  comment: string
) {
  const doc = await Shipment.findOne(tenantFilter(orgId, { _id: new Types.ObjectId(id) }));
  if (!doc) throw notFound("Gönderi bulunamadı");
  if (doc.status === toStatus) return doc.toClient();

  const fromStatus = doc.status;

  // Cancel → reverse the qtyAvailable changes + create reverse transactions.
  if (toStatus === "iptal" && fromStatus !== "iptal") {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        for (const item of doc.items) {
          // $inc + капчуим обновлённый lot, чтобы вычислить корректный статус.
          // Безусловный $set: "in_stock" был багом: если лот участвует ещё в
          // активном шипменте, после возврата qty статус всё равно должен
          // быть "partially_shipped" (qtyAvailable < qtyIn), а не "in_stock".
          const updated = await InboundLot.findOneAndUpdate(
            { _id: item.lotId, orgId: doc.orgId },
            { $inc: { qtyAvailable: item.qty } },
            { new: true, session }
          );
          if (updated) {
            const newStatus =
              updated.qtyAvailable >= updated.qtyIn ? "in_stock" : "partially_shipped";
            if (updated.status !== newStatus) {
              await InboundLot.updateOne(
                { _id: item.lotId },
                { $set: { status: newStatus } },
                { session }
              );
            }
          }
        }

        const originals = await Transaction.find({ shipmentId: doc._id }, null, { session });
        for (const orig of originals) {
          if (orig.kind === "adjustment") continue;
          await createTx(
            orgId,
            {
              kind: "adjustment",
              counterparty: {
                type: orig.counterparty.type,
                id: orig.counterparty.id.toString(),
              },
              shipmentId: doc._id.toString(),
              amount: orig.amount,
              currency: orig.currency,
              direction: orig.direction === "debit" ? "credit" : "debit",
              notes: `İptal: ${doc.shortCode}`,
              reversesTransactionId: orig._id.toString(),
            },
            session
          );
        }

        doc.status = "iptal";
        doc.statusHistory.push({
          fromStatus,
          toStatus: "iptal",
          changedBy: new Types.ObjectId(userId),
          changedAt: new Date(),
          comment: comment || "İptal edildi",
        });
        await doc.save({ session });
      });
    } finally {
      await session.endSession();
    }
  } else {
    doc.status = toStatus;
    doc.statusHistory.push({
      fromStatus,
      toStatus,
      changedBy: new Types.ObjectId(userId),
      changedAt: new Date(),
      comment: comment || "",
    });
    await doc.save();
  }

  const json = doc.toClient();
  emitOrgEvent(orgId, "shipment:status_changed", json);

  // Enqueue notifications for carrier + every distinct sender attached to lots.
  const tplKey = STATUS_TO_TEMPLATE[toStatus];
  if (tplKey) {
    const trackingUrl = `${env.WEB_BASE_URL}/track/${doc.publicTrackingToken}`;
    const vars: Record<string, unknown> = {
      shortCode: doc.shortCode,
      recipientName: doc.recipient?.name || "",
      trackingUrl,
      status: toStatus,
    };

    const carrier = await Carrier.findById(doc.carrierId);
    if (carrier?.telegramChatId) {
      await enqueueNotification({
        orgId,
        templateKey: tplKey,
        recipient: {
          type: "carrier",
          id: carrier._id.toString(),
          chatId: carrier.telegramChatId,
        },
        vars,
      });
    }

    const lotIds = Array.from(new Set(doc.items.map((i) => i.lotId.toString())));
    const lots = await InboundLot.find({ _id: { $in: lotIds } });
    const senderIds = Array.from(new Set(lots.map((l) => l.senderId.toString())));
    const senders = await Sender.find({ _id: { $in: senderIds } });
    for (const sender of senders) {
      if (!sender.telegramChatId) continue;
      await enqueueNotification({
        orgId,
        templateKey: tplKey,
        recipient: {
          type: "sender",
          id: sender._id.toString(),
          chatId: sender.telegramChatId,
        },
        vars,
      });
    }
  }

  return json;
}

const STATUS_TO_TEMPLATE: Partial<
  Record<
    Status,
    "shipment_yolda" | "shipment_teslim" | "shipment_kayip" | "shipment_iptal" | "shipment_bekliyor"
  >
> = {
  bekliyor: "shipment_bekliyor",
  yolda: "shipment_yolda",
  teslim: "shipment_teslim",
  kayip: "shipment_kayip",
  iptal: "shipment_iptal",
};

export async function findByTrackingToken(token: string) {
  const doc = await Shipment.findOne({ publicTrackingToken: token, deletedAt: null });
  if (!doc) throw notFound("Takip kodu geçersiz");
  return doc.toPublicJSON();
}

/** Resets all counters — used in tests only. Защита от случайного вызова
 *  из контроллера/middleware в проде (выпил счётчиков → коллизии shortCode). */
export async function _resetCounters() {
  if (env.NODE_ENV !== "test") {
    throw new Error("_resetCounters is test-only — guarded by NODE_ENV");
  }
  await Counter.deleteMany({});
}
