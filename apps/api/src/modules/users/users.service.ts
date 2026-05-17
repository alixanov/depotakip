import { randomBytes } from "node:crypto";
import { Types } from "mongoose";
import type { CreateUserInput, UpdateUserInput, PaginatedResponse } from "@sadiyakargo/shared";
import { conflict, notFound } from "../../lib/errors.js";
import { hash } from "../../lib/password.js";
import { sendMail } from "../../lib/mailer.js";
import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import { User, type UserDoc } from "../auth/user.model.js";

interface ListQuery {
  page?: number;
  limit?: number;
  search?: string;
}

type SafeUser = ReturnType<UserDoc["toSafeJSON"]>;

export async function list(orgId: string, query: ListQuery): Promise<PaginatedResponse<SafeUser>> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const filter: Record<string, unknown> = { orgId: new Types.ObjectId(orgId), deletedAt: null };
  if (query.search) {
    filter.$or = [
      { email: { $regex: query.search, $options: "i" } },
      { fullName: { $regex: query.search, $options: "i" } },
    ];
  }

  const [docs, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  return {
    data: docs.map((d) => d.toSafeJSON()),
    pagination: { page, limit, total, hasMore: page * limit < total },
  };
}

export async function get(orgId: string, id: string): Promise<SafeUser> {
  const user = await User.findOne({
    _id: id,
    orgId: new Types.ObjectId(orgId),
    deletedAt: null,
  });
  if (!user) throw notFound("Kullanıcı bulunamadı");
  return user.toSafeJSON();
}

export async function create(
  orgId: string,
  input: CreateUserInput
): Promise<{ user: SafeUser; tempPassword: string }> {
  const existing = await User.findOne({ email: input.email.toLowerCase() });
  if (existing) throw conflict("Bu email zaten kayıtlı");

  const tempPassword = randomBytes(12).toString("base64url");
  const passwordHash = await hash(tempPassword);

  const user = await User.create({
    orgId: new Types.ObjectId(orgId),
    email: input.email,
    passwordHash,
    fullName: input.fullName,
    phone: input.phone,
    role: input.role,
    active: true,
    mustChangePassword: true,
  });

  await sendMail({
    to: user.email,
    subject: "Depo Yönetim — Hesabınız oluşturuldu",
    text: `Merhaba ${user.fullName},

Depo Yönetim Sistemi'nde sizin için bir hesap oluşturuldu.
Geçici şifreniz: ${tempPassword}

Lütfen ${env.WEB_BASE_URL}/login adresinden giriş yapın ve ilk kullanımda şifrenizi değiştirin.`,
  });

  logger.info({ userId: user._id.toString(), email: user.email }, "user_created");

  return { user: user.toSafeJSON(), tempPassword };
}

export async function update(orgId: string, id: string, input: UpdateUserInput): Promise<SafeUser> {
  const user = await User.findOneAndUpdate(
    { _id: id, orgId: new Types.ObjectId(orgId), deletedAt: null },
    { $set: input },
    { new: true, runValidators: true }
  );
  if (!user) throw notFound("Kullanıcı bulunamadı");
  return user.toSafeJSON();
}

export async function softDelete(orgId: string, id: string, requesterId: string): Promise<void> {
  if (id === requesterId) {
    throw conflict("Kendinizi silemezsiniz");
  }
  const user = await User.findOneAndUpdate(
    { _id: id, orgId: new Types.ObjectId(orgId), deletedAt: null },
    { $set: { deletedAt: new Date(), active: false } }
  );
  if (!user) throw notFound("Kullanıcı bulunamadı");
}
