import { randomBytes, createHash } from "node:crypto";
import { Types } from "mongoose";
import { conflict, notFound, unauthorized } from "../../lib/errors.js";
import { hash, compare } from "../../lib/password.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../lib/jwt.js";
import { parseDuration } from "../../lib/duration.js";
import { env } from "../../config/env.js";
import { sendMail } from "../../lib/mailer.js";
import { logger } from "../../lib/logger.js";
import { Role } from "../access/role.model.js";
import { User, type UserDoc, loadRoleRef } from "./user.model.js";
import { RefreshToken } from "./refreshToken.model.js";
import { PasswordResetToken } from "./passwordResetToken.model.js";

interface IssueOptions {
  userAgent: string;
  ip: string;
  // Replace existing refresh token (rotation). When set, the old token will be
  // marked as `revoked + replacedBy = new.tokenId`.
  replacesTokenId?: string;
}

interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  user: ReturnType<UserDoc["toSafeJSON"]>;
}

export interface AuthContext {
  userAgent: string;
  ip: string;
}

async function issueTokens(user: UserDoc, opts: IssueOptions): Promise<IssuedTokens> {
  const tokenId = randomBytes(16).toString("hex");
  const refreshToken = signRefreshToken({ sub: user._id.toString(), tokenId });

  const expiresAt = new Date(Date.now() + parseDuration(env.JWT_REFRESH_TTL));
  await RefreshToken.create({
    tokenId,
    userId: user._id,
    orgId: user.orgId,
    userAgent: opts.userAgent,
    ip: opts.ip,
    expiresAt,
  });

  if (opts.replacesTokenId) {
    await RefreshToken.updateOne(
      { tokenId: opts.replacesTokenId },
      { $set: { revokedAt: new Date(), replacedBy: tokenId } }
    );
  }

  // Snapshot permissions at issue time. Access tokens are short-lived (15m)
  // and /auth/refresh re-reads the role on rotation, so permission changes
  // propagate within one token cycle without invalidating active sessions.
  const role = await loadRoleRef(user.roleId);

  const accessToken = signAccessToken({
    sub: user._id.toString(),
    orgId: user.orgId.toString(),
    roleId: role.id,
    permissions: role.permissions,
  });

  return { accessToken, refreshToken, user: user.toSafeJSON(role) };
}

export async function login(
  email: string,
  password: string,
  ctx: AuthContext
): Promise<IssuedTokens> {
  // email уже .trim().toLowerCase() через loginSchema/emailSchema.
  const user = await User.findOne({ email, deletedAt: null });
  if (!user) throw unauthorized("err:invalid_credentials");
  if (!user.active) throw unauthorized("err:account_disabled");

  const ok = await compare(password, user.passwordHash);
  if (!ok) throw unauthorized("err:invalid_credentials");

  user.lastLoginAt = new Date();
  await user.save();

  return issueTokens(user, ctx);
}

export async function refresh(refreshTokenJwt: string, ctx: AuthContext): Promise<IssuedTokens> {
  let payload: { sub: string; tokenId: string };
  try {
    payload = verifyRefreshToken(refreshTokenJwt);
  } catch {
    throw unauthorized("err:invalid_refresh_token");
  }

  const record = await RefreshToken.findOne({ tokenId: payload.tokenId });
  if (!record) throw unauthorized("err:refresh_token_not_found");

  if (record.revokedAt) {
    // Replay attack — invalidate all tokens for this user (defence in depth).
    await RefreshToken.updateMany(
      { userId: record.userId, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
    throw unauthorized("err:refresh_token_replay");
  }

  if (record.expiresAt.getTime() < Date.now()) {
    throw unauthorized("err:refresh_token_expired");
  }

  const user = await User.findById(record.userId);
  if (!user || !user.active || user.deletedAt) {
    throw unauthorized("err:user_not_found");
  }

  return issueTokens(user, { ...ctx, replacesTokenId: record.tokenId });
}

export async function logout(refreshTokenJwt: string | undefined): Promise<void> {
  if (!refreshTokenJwt) return;
  try {
    const { tokenId } = verifyRefreshToken(refreshTokenJwt);
    await RefreshToken.updateOne({ tokenId, revokedAt: null }, { $set: { revokedAt: new Date() } });
  } catch {
    // ignore — already invalid
  }
}

export async function me(userId: string) {
  const user = await User.findOne({ _id: userId, deletedAt: null });
  if (!user) throw notFound("err:user_not_found");
  const role = await loadRoleRef(user.roleId);
  return user.toSafeJSON(role);
}

export async function forgotPassword(email: string): Promise<void> {
  // email уже .trim().toLowerCase() через forgotPasswordSchema.
  const user = await User.findOne({ email, deletedAt: null });
  if (!user) {
    // Don't reveal whether the email exists.
    logger.info({ email }, "forgot_password_unknown_email");
    return;
  }

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await PasswordResetToken.create({
    userId: user._id,
    tokenHash,
    expiresAt,
  });

  const link = `${env.WEB_BASE_URL}/reset-password/${rawToken}`;
  await sendMail({
    to: user.email,
    subject: "Şifre sıfırlama",
    text: `Şifrenizi sıfırlamak için: ${link}\nBu bağlantı 1 saat sonra geçersiz olacaktır.`,
  });
}

export async function resetPassword(rawToken: string, newPassword: string): Promise<void> {
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const record = await PasswordResetToken.findOne({ tokenHash });
  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    throw unauthorized("err:reset_token_invalid");
  }

  const user = await User.findById(record.userId);
  if (!user || user.deletedAt) throw notFound("err:user_not_found");

  user.passwordHash = await hash(newPassword);
  user.mustChangePassword = false;
  await user.save();

  record.usedAt = new Date();
  await record.save();

  // Invalidate all active refresh tokens for this user.
  await RefreshToken.updateMany(
    { userId: user._id, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const user = await User.findOne({ _id: userId, deletedAt: null });
  if (!user) throw notFound("err:user_not_found");

  const ok = await compare(currentPassword, user.passwordHash);
  if (!ok) throw unauthorized("err:current_password_wrong");

  user.passwordHash = await hash(newPassword);
  user.mustChangePassword = false;
  await user.save();
}

/** Used by the seed migration to create the first admin idempotently. */
export async function ensureAdmin(args: {
  email: string;
  password: string;
  fullName: string;
  orgId: Types.ObjectId | string;
}): Promise<UserDoc> {
  const existing = await User.findOne({ email: args.email.toLowerCase() });
  if (existing) return existing;
  const orgId = new Types.ObjectId(args.orgId);
  const adminRole = await Role.findOne({ orgId, name: "admin", isSystem: true });
  if (!adminRole) {
    // RBAC migration hasn't run yet — caller should retry after migrations.
    throw new Error("System admin role missing — run npm run migrate:up first");
  }
  const passwordHash = await hash(args.password);
  try {
    return await User.create({
      orgId,
      email: args.email,
      passwordHash,
      fullName: args.fullName,
      roleId: adminRole._id,
      active: true,
      mustChangePassword: false,
    });
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: number }).code === 11000
    ) {
      throw conflict("err:email_taken");
    }
    throw err;
  }
}
