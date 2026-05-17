import { Types } from "mongoose";
import type { CreateSenderInput, UpdateSenderInput } from "@depotakip/shared";
import { notFound } from "../../lib/errors.js";
import { paginate, softDeleteOne, tenantFilter } from "../../lib/repository.js";
import { Sender } from "./sender.model.js";

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
        { fullName: { $regex: query.search, $options: "i" } },
        { phone: { $regex: query.search, $options: "i" } },
      ],
    });
  }
  return paginate(Sender, filter, query, (d) => d.toClient());
}

export async function get(orgId: string, id: string) {
  const doc = await Sender.findOne(tenantFilter(orgId, { _id: new Types.ObjectId(id) }));
  if (!doc) throw notFound("Gönderici bulunamadı");
  return doc.toClient();
}

export async function create(orgId: string, input: CreateSenderInput) {
  const doc = await Sender.create({ orgId: new Types.ObjectId(orgId), ...input });
  return doc.toClient();
}

export async function update(orgId: string, id: string, input: UpdateSenderInput) {
  const doc = await Sender.findOneAndUpdate(
    tenantFilter(orgId, { _id: new Types.ObjectId(id) }),
    { $set: input },
    { new: true, runValidators: true }
  );
  if (!doc) throw notFound("Gönderici bulunamadı");
  return doc.toClient();
}

export async function remove(orgId: string, id: string) {
  const doc = await softDeleteOne(Sender, orgId, id);
  if (!doc) throw notFound("Gönderici bulunamadı");
}
