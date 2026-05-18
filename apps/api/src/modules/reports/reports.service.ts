import { Types } from "mongoose";
import { Shipment } from "../shipments/shipment.model.js";
import { InboundLot } from "../lots/lot.model.js";
import { Transaction } from "../transactions/transaction.model.js";

interface DateRange {
  from?: string;
  to?: string;
}

function rangeFilter(range: DateRange, field = "createdAt") {
  if (!range.from && !range.to) return {};
  const out: Record<string, Date> = {};
  if (range.from) out.$gte = new Date(range.from);
  if (range.to) out.$lte = new Date(range.to);
  return { [field]: out };
}

function tenant(orgId: string) {
  return { orgId: new Types.ObjectId(orgId), deletedAt: null };
}

// ---------------- Dashboard ----------------

export interface DashboardKpi {
  shipmentsTotal: number;
  shipmentsByStatus: Record<string, number>;
  stockTotal: number;
  carrierBalanceUsd: number;
  shipmentsByDay: { day: string; count: number }[];
  receivedByDay: { day: string; qty: number }[];
}

export async function dashboard(orgId: string, range: DateRange = {}): Promise<DashboardKpi> {
  const [statusCounts, stockTotal, carrierBal, shipDaily, lotDaily] = await Promise.all([
    Shipment.aggregate<{ _id: string; n: number }>([
      { $match: { ...tenant(orgId), ...rangeFilter(range, "shipmentDate") } },
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ]),
    InboundLot.aggregate<{ total: number }>([
      { $match: { ...tenant(orgId), qtyAvailable: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: "$qtyAvailable" } } },
    ]).then((r) => r[0]?.total || 0),
    Transaction.aggregate<{ d: number; c: number }>([
      { $match: { orgId: new Types.ObjectId(orgId), "counterparty.type": "carrier" } },
      {
        $group: {
          _id: null,
          d: {
            $sum: { $cond: [{ $eq: ["$direction", "debit"] }, "$amountUsdSnapshot", 0] },
          },
          c: {
            $sum: { $cond: [{ $eq: ["$direction", "credit"] }, "$amountUsdSnapshot", 0] },
          },
        },
      },
    ]).then((r) => (r[0] ? r[0].d - r[0].c : 0)),
    Shipment.aggregate<{ _id: string; n: number }>([
      { $match: { ...tenant(orgId), ...rangeFilter(range, "shipmentDate") } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$shipmentDate" } },
          n: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 90 },
    ]),
    InboundLot.aggregate<{ _id: string; qty: number }>([
      { $match: { ...tenant(orgId), ...rangeFilter(range, "receivedAt") } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$receivedAt" } },
          qty: { $sum: "$qtyIn" },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 90 },
    ]),
  ]);

  const shipmentsByStatus: Record<string, number> = {};
  let shipmentsTotal = 0;
  for (const row of statusCounts) {
    shipmentsByStatus[row._id] = row.n;
    shipmentsTotal += row.n;
  }

  return {
    shipmentsTotal,
    shipmentsByStatus,
    stockTotal,
    carrierBalanceUsd: carrierBal,
    shipmentsByDay: shipDaily.map((r) => ({ day: r._id, count: r.n })),
    receivedByDay: lotDaily.map((r) => ({ day: r._id, qty: r.qty })),
  };
}

// ---------------- Reports ----------------

export interface CarrierReportRow {
  carrierId: string;
  name: string;
  shipments: number;
  itemsTotal: number;
  chargesUsd: number;
  paymentsUsd: number;
  balanceUsd: number;
}

export async function carriers(orgId: string, range: DateRange = {}): Promise<CarrierReportRow[]> {
  const shipmentStats = await Shipment.aggregate<{
    _id: Types.ObjectId;
    shipments: number;
    itemsTotal: number;
  }>([
    { $match: { ...tenant(orgId), ...rangeFilter(range, "shipmentDate") } },
    {
      $group: {
        _id: "$carrierId",
        shipments: { $sum: 1 },
        itemsTotal: { $sum: { $sum: "$items.qty" } },
      },
    },
  ]);

  const finStats = await Transaction.aggregate<{
    _id: Types.ObjectId;
    chargesUsd: number;
    paymentsUsd: number;
  }>([
    {
      $match: {
        orgId: new Types.ObjectId(orgId),
        "counterparty.type": "carrier",
        ...rangeFilter(range, "txDate"),
      },
    },
    {
      $group: {
        _id: "$counterparty.id",
        chargesUsd: {
          $sum: { $cond: [{ $eq: ["$direction", "debit"] }, "$amountUsdSnapshot", 0] },
        },
        paymentsUsd: {
          $sum: { $cond: [{ $eq: ["$direction", "credit"] }, "$amountUsdSnapshot", 0] },
        },
      },
    },
    {
      $lookup: {
        from: "carriers",
        localField: "_id",
        foreignField: "_id",
        as: "carrier",
      },
    },
  ]);

  const carrierIds = new Set<string>([
    ...shipmentStats.map((s) => s._id.toString()),
    ...finStats.map((s) => s._id.toString()),
  ]);

  const finById = new Map(finStats.map((f) => [f._id.toString(), f]));
  const shipById = new Map(shipmentStats.map((s) => [s._id.toString(), s]));

  // Resolve names with a single lookup if shipments don't carry it.
  const carriersList = await (
    await import("../carriers/carrier.model.js")
  ).Carrier.find({ _id: { $in: Array.from(carrierIds).map((id) => new Types.ObjectId(id)) } });
  const nameById = new Map(
    carriersList.map((c) => [c._id.toString(), `${c.firstName} ${c.lastName}`])
  );

  return Array.from(carrierIds)
    .map((id) => {
      const fin = finById.get(id);
      const ship = shipById.get(id);
      return {
        carrierId: id,
        name: nameById.get(id) || "—",
        shipments: ship?.shipments || 0,
        itemsTotal: ship?.itemsTotal || 0,
        chargesUsd: fin?.chargesUsd || 0,
        paymentsUsd: fin?.paymentsUsd || 0,
        balanceUsd: (fin?.chargesUsd || 0) - (fin?.paymentsUsd || 0),
      };
    })
    .sort((a, b) => b.balanceUsd - a.balanceUsd);
}

export interface SenderReportRow {
  senderId: string;
  name: string;
  lots: number;
  qtyIn: number;
}

/**
 * Senders report — partitioning stats only (we don't track money for
 * senders anymore; that was removed in v2.3 together with sender_charge /
 * sender_payment transactions).
 */
export async function senders(orgId: string, range: DateRange = {}): Promise<SenderReportRow[]> {
  const lotStats = await InboundLot.aggregate<{
    _id: Types.ObjectId;
    lots: number;
    qtyIn: number;
  }>([
    { $match: { ...tenant(orgId), ...rangeFilter(range, "receivedAt") } },
    { $group: { _id: "$senderId", lots: { $sum: 1 }, qtyIn: { $sum: "$qtyIn" } } },
  ]);

  if (lotStats.length === 0) return [];

  const ids = lotStats.map((s) => s._id);
  const sendersList = await (
    await import("../senders/sender.model.js")
  ).Sender.find({
    _id: { $in: ids },
  });
  const nameById = new Map(sendersList.map((s) => [s._id.toString(), s.fullName]));

  return lotStats
    .map((s) => ({
      senderId: s._id.toString(),
      name: nameById.get(s._id.toString()) || "—",
      lots: s.lots,
      qtyIn: s.qtyIn,
    }))
    .sort((a, b) => b.qtyIn - a.qtyIn);
}

export interface FinanceReportRow {
  date: string;
  carrierChargesUsd: number;
  carrierPaymentsUsd: number;
}

export async function finance(orgId: string, range: DateRange = {}): Promise<FinanceReportRow[]> {
  const rows = await Transaction.aggregate<{
    _id: string;
    cc: number;
    cp: number;
  }>([
    { $match: { orgId: new Types.ObjectId(orgId), ...rangeFilter(range, "txDate") } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$txDate" } },
        cc: {
          $sum: {
            $cond: [{ $eq: ["$kind", "carrier_charge"] }, "$amountUsdSnapshot", 0],
          },
        },
        cp: {
          $sum: {
            $cond: [{ $eq: ["$kind", "carrier_payment"] }, "$amountUsdSnapshot", 0],
          },
        },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  return rows.map((r) => ({
    date: r._id,
    carrierChargesUsd: r.cc,
    carrierPaymentsUsd: r.cp,
  }));
}
