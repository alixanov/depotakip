import { Types } from "mongoose";
import type { CreateLotInput, UpdateLotInput } from "@sadiyakargo/shared";
import { badRequest, conflict, notFound } from "../../lib/errors.js";
import { paginate, softDeleteOne, tenantFilter } from "../../lib/repository.js";
import { Category } from "../categories/category.model.js";
import { Sender } from "../senders/sender.model.js";
import { InboundLot } from "./lot.model.js";

interface ListQuery {
  page?: number;
  limit?: number;
  sort?: string;
  senderId?: string;
  categoryId?: string;
  status?: string;
  from?: string;
  to?: string;
  availableOnly?: boolean;
}

export async function list(orgId: string, query: ListQuery) {
  const filter = tenantFilter(orgId);
  if (query.senderId) Object.assign(filter, { senderId: new Types.ObjectId(query.senderId) });
  if (query.categoryId) Object.assign(filter, { categoryId: new Types.ObjectId(query.categoryId) });
  if (query.status) Object.assign(filter, { status: query.status });
  if (query.availableOnly) Object.assign(filter, { qtyAvailable: { $gt: 0 } });
  if (query.from || query.to) {
    const range: Record<string, Date> = {};
    if (query.from) range.$gte = new Date(query.from);
    if (query.to) range.$lte = new Date(query.to);
    Object.assign(filter, { receivedAt: range });
  }
  return paginate(InboundLot, filter, query, (d) => d.toClient(), { receivedAt: -1 });
}

export async function get(orgId: string, id: string) {
  const doc = await InboundLot.findOne(tenantFilter(orgId, { _id: new Types.ObjectId(id) }));
  if (!doc) throw notFound("Parti bulunamadı");
  return doc.toClient();
}

export async function create(orgId: string, input: CreateLotInput) {
  // Verify references belong to the same org.
  const [sender, category] = await Promise.all([
    Sender.findOne(tenantFilter(orgId, { _id: new Types.ObjectId(input.senderId) })),
    Category.findOne(tenantFilter(orgId, { _id: new Types.ObjectId(input.categoryId) })),
  ]);
  if (!sender) throw badRequest("Gönderici bulunamadı");
  if (!category) throw badRequest("Kategori bulunamadı");

  const doc = await InboundLot.create({
    orgId: new Types.ObjectId(orgId),
    senderId: sender._id,
    categoryId: category._id,
    qtyIn: input.qtyIn,
    qtyAvailable: input.qtyIn,
    unitPrice: input.unitPrice ?? null,
    receivedAt: input.receivedAt ? new Date(input.receivedAt) : new Date(),
    notes: input.notes ?? "",
    status: "in_stock",
  });
  return doc.toClient();
}

export async function update(orgId: string, id: string, input: UpdateLotInput) {
  // Per TZ: only `notes` is mutable once the lot is in.
  const doc = await InboundLot.findOneAndUpdate(
    tenantFilter(orgId, { _id: new Types.ObjectId(id) }),
    { $set: { notes: input.notes ?? "" } },
    { new: true, runValidators: true }
  );
  if (!doc) throw notFound("Parti bulunamadı");
  return doc.toClient();
}

export async function remove(orgId: string, id: string) {
  const doc = await InboundLot.findOne(tenantFilter(orgId, { _id: new Types.ObjectId(id) }));
  if (!doc) throw notFound("Parti bulunamadı");
  if (doc.qtyAvailable !== doc.qtyIn) {
    throw conflict("Sevkiyatı olan parti silinemez");
  }
  await softDeleteOne(InboundLot, orgId, id);
}

interface StockBreakdownRow {
  id: string;
  name: string;
  totalAvailable: number;
  lots: number;
}

export async function stockByCategory(orgId: string): Promise<StockBreakdownRow[]> {
  const rows = await InboundLot.aggregate<{
    _id: Types.ObjectId;
    totalAvailable: number;
    lots: number;
    name?: string;
    icon?: string;
  }>([
    { $match: { ...tenantFilter(orgId), qtyAvailable: { $gt: 0 } } },
    {
      $group: {
        _id: "$categoryId",
        totalAvailable: { $sum: "$qtyAvailable" },
        lots: { $sum: 1 },
      },
    },
    {
      $lookup: {
        from: "categories",
        localField: "_id",
        foreignField: "_id",
        as: "category",
      },
    },
    {
      $project: {
        _id: 1,
        totalAvailable: 1,
        lots: 1,
        name: { $arrayElemAt: ["$category.name", 0] },
      },
    },
    { $sort: { totalAvailable: -1 } },
  ]);

  return rows.map((r) => ({
    id: r._id.toString(),
    name: r.name || "—",
    totalAvailable: r.totalAvailable,
    lots: r.lots,
  }));
}

export async function stockBySender(orgId: string): Promise<StockBreakdownRow[]> {
  const rows = await InboundLot.aggregate<{
    _id: Types.ObjectId;
    totalAvailable: number;
    lots: number;
    name?: string;
  }>([
    { $match: { ...tenantFilter(orgId), qtyAvailable: { $gt: 0 } } },
    {
      $group: {
        _id: "$senderId",
        totalAvailable: { $sum: "$qtyAvailable" },
        lots: { $sum: 1 },
      },
    },
    {
      $lookup: {
        from: "senders",
        localField: "_id",
        foreignField: "_id",
        as: "sender",
      },
    },
    {
      $project: {
        _id: 1,
        totalAvailable: 1,
        lots: 1,
        name: { $arrayElemAt: ["$sender.fullName", 0] },
      },
    },
    { $sort: { totalAvailable: -1 } },
  ]);

  return rows.map((r) => ({
    id: r._id.toString(),
    name: r.name || "—",
    totalAvailable: r.totalAvailable,
    lots: r.lots,
  }));
}
