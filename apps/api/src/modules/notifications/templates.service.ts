import { Types } from "mongoose";
import type { CreateTemplateInput, UpdateTemplateInput } from "@depotakip/shared";
import { conflict, notFound } from "../../lib/errors.js";
import { tenantFilter } from "../../lib/repository.js";
import { NotificationTemplate } from "./template.model.js";

export async function list(orgId: string) {
  const docs = await NotificationTemplate.find(tenantFilter(orgId)).sort({
    key: 1,
    channel: 1,
    language: 1,
  });
  return docs.map((d) => d.toClient());
}

export async function get(orgId: string, id: string) {
  const doc = await NotificationTemplate.findOne(
    tenantFilter(orgId, { _id: new Types.ObjectId(id) })
  );
  if (!doc) throw notFound("Şablon bulunamadı");
  return doc.toClient();
}

export async function create(orgId: string, input: CreateTemplateInput) {
  try {
    const doc = await NotificationTemplate.create({
      orgId: new Types.ObjectId(orgId),
      ...input,
    });
    return doc.toClient();
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: number }).code === 11000
    ) {
      throw conflict("Bu şablon (key+channel+language) zaten mevcut");
    }
    throw err;
  }
}

export async function update(orgId: string, id: string, input: UpdateTemplateInput) {
  const doc = await NotificationTemplate.findOneAndUpdate(
    tenantFilter(orgId, { _id: new Types.ObjectId(id) }),
    { $set: input },
    { new: true, runValidators: true }
  );
  if (!doc) throw notFound("Şablon bulunamadı");
  return doc.toClient();
}

export async function remove(orgId: string, id: string) {
  const doc = await NotificationTemplate.findOneAndDelete(
    tenantFilter(orgId, { _id: new Types.ObjectId(id) })
  );
  if (!doc) throw notFound("Şablon bulunamadı");
}
