import { randomBytes } from "node:crypto";
import { Types } from "mongoose";
import type { CreateUserInput, UpdateUserInput, PaginatedResponse } from "@sadiyakargo/shared";
import { badRequest, conflict, notFound } from "../../lib/errors.js";
import { hash } from "../../lib/password.js";
import { sendMail } from "../../lib/mailer.js";
import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import { paginate, tenantFilter } from "../../lib/repository.js";
import { Role } from "../access/role.model.js";
import { User, type UserDoc, loadRoleRef } from "../auth/user.model.js";

interface ListQuery {
  page?: number;
  limit?: number;
  search?: string;
}

type SafeUser = ReturnType<UserDoc["toSafeJSON"]>;

async function asSafeJSON(user: UserDoc): Promise<SafeUser> {
  const role = await loadRoleRef(user.roleId);
  return user.toSafeJSON(role);
}

export async function list(orgId: string, query: ListQuery): Promise<PaginatedResponse<SafeUser>> {
  const filter = tenantFilter(orgId);
  if (query.search) {
    Object.assign(filter, {
      $or: [
        { email: { $regex: query.search, $options: "i" } },
        { fullName: { $regex: query.search, $options: "i" } },
      ],
    });
  }
  return paginate(User, filter, query, asSafeJSON);
}

export async function get(orgId: string, id: string): Promise<SafeUser> {
  const user = await User.findOne({
    _id: id,
    orgId: new Types.ObjectId(orgId),
    deletedAt: null,
  });
  if (!user) throw notFound("err:user_not_found");
  return asSafeJSON(user);
}

export async function create(
  orgId: string,
  input: CreateUserInput
): Promise<{ user: SafeUser; tempPassword: string }> {
  // email уже .trim().toLowerCase() через emailSchema (createUserSchema).
  const existing = await User.findOne({ email: input.email });
  if (existing) throw conflict("err:email_taken");

  // Confirm the role belongs to this org — protects against assigning a role
  // owned by another tenant via a leaked id.
  const role = await Role.findOne({
    _id: new Types.ObjectId(input.roleId),
    orgId: new Types.ObjectId(orgId),
  });
  if (!role) throw badRequest("err:role_not_found");

  const tempPassword = randomBytes(12).toString("base64url");
  const passwordHash = await hash(tempPassword);

  const user = await User.create({
    orgId: new Types.ObjectId(orgId),
    email: input.email,
    passwordHash,
    fullName: input.fullName,
    phone: input.phone,
    roleId: role._id,
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

  return { user: await asSafeJSON(user), tempPassword };
}

export async function update(
  orgId: string,
  id: string,
  input: UpdateUserInput,
  requesterId: string
): Promise<SafeUser> {
  const orgObjectId = new Types.ObjectId(orgId);
  if (input.roleId) {
    const role = await Role.findOne({ _id: new Types.ObjectId(input.roleId), orgId: orgObjectId });
    if (!role) throw badRequest("err:role_not_found");
  }
  // Self-protection: a user with `users:manage` could otherwise promote
  // themselves into a higher-privileged role by editing their own row.
  // Disabling oneself is also blocked for the same lockout reason.
  if (id === requesterId) {
    if (input.roleId !== undefined) {
      throw conflict("err:cannot_change_own_role");
    }
    if (input.active === false) {
      throw conflict("err:cannot_disable_self");
    }
  }
  const $set: Record<string, unknown> = {};
  if (input.fullName !== undefined) $set.fullName = input.fullName;
  if (input.phone !== undefined) $set.phone = input.phone;
  if (input.roleId !== undefined) $set.roleId = new Types.ObjectId(input.roleId);
  if (input.active !== undefined) $set.active = input.active;
  const user = await User.findOneAndUpdate(
    { _id: id, orgId: orgObjectId, deletedAt: null },
    { $set },
    { new: true, runValidators: true }
  );
  if (!user) throw notFound("err:user_not_found");
  return asSafeJSON(user);
}

export async function softDelete(orgId: string, id: string, requesterId: string): Promise<void> {
  if (id === requesterId) {
    throw conflict("err:cannot_delete_self");
  }
  const user = await User.findOneAndUpdate(
    { _id: id, orgId: new Types.ObjectId(orgId), deletedAt: null },
    { $set: { deletedAt: new Date(), active: false } }
  );
  if (!user) throw notFound("err:user_not_found");
}
