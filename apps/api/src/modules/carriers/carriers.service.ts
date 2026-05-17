import { Types } from "mongoose";
import type { CreateCarrierInput, UpdateCarrierInput } from "@sadiyakargo/shared";
import { notFound } from "../../lib/errors.js";
import { paginate, softDeleteOne, tenantFilter } from "../../lib/repository.js";
import { Carrier } from "./carrier.model.js";

interface ListQuery {
  page?: number;
  limit?: number;
  search?: string;
}

export async function list(orgId: string, query: ListQuery) {
  const filter = tenantFilter(orgId);
  if (query.search) {
    Object.assign(filter, {
      $or: [
        { firstName: { $regex: query.search, $options: "i" } },
        { lastName: { $regex: query.search, $options: "i" } },
        { phone: { $regex: query.search, $options: "i" } },
      ],
    });
  }
  return paginate(Carrier, filter, query, (d) => d.toClient());
}

export async function get(orgId: string, id: string) {
  const doc = await Carrier.findOne(tenantFilter(orgId, { _id: new Types.ObjectId(id) }));
  if (!doc) throw notFound("Kargocu bulunamadı");
  return doc.toClient();
}

export async function create(orgId: string, input: CreateCarrierInput) {
  const doc = await Carrier.create({ orgId: new Types.ObjectId(orgId), ...input });
  return doc.toClient();
}

export async function update(orgId: string, id: string, input: UpdateCarrierInput) {
  const doc = await Carrier.findOneAndUpdate(
    tenantFilter(orgId, { _id: new Types.ObjectId(id) }),
    { $set: input },
    { new: true, runValidators: true }
  );
  if (!doc) throw notFound("Kargocu bulunamadı");
  return doc.toClient();
}

export async function remove(orgId: string, id: string) {
  const doc = await softDeleteOne(Carrier, orgId, id);
  if (!doc) throw notFound("Kargocu bulunamadı");
}
