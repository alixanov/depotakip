import request from "supertest";
import { Types } from "mongoose";
import type { Role } from "@sadiyakargo/shared";
import { createApp } from "../src/app.ts";
import { env } from "../src/config/env.ts";
import { hash } from "../src/lib/password.ts";
import { User, type UserDoc } from "../src/modules/auth/user.model.ts";
import { REFRESH_COOKIE } from "../src/lib/cookies.ts";

export const app = createApp();
export { request };

export const ORG_ID = new Types.ObjectId(env.DEFAULT_ORG_ID);
export const apiPath = (p: string) => `${env.API_PREFIX}${p}`;

interface CreateUserOpts {
  email?: string;
  password?: string;
  fullName?: string;
  role?: Role;
  active?: boolean;
  orgId?: Types.ObjectId;
}

export async function createTestUser(opts: CreateUserOpts = {}): Promise<{
  user: UserDoc;
  password: string;
}> {
  const password = opts.password || "Passw0rd!!";
  const email = opts.email || `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@x.io`;
  const user = await User.create({
    orgId: opts.orgId || ORG_ID,
    email,
    passwordHash: await hash(password),
    fullName: opts.fullName || "Test User",
    role: opts.role || "operator",
    active: opts.active !== false,
    mustChangePassword: false,
  });
  return { user, password };
}

export async function login(email: string, password: string) {
  const res = await request(app).post(apiPath("/auth/login")).send({ email, password }).expect(200);
  return {
    accessToken: res.body.accessToken as string,
    refreshCookie: extractRefreshCookie(res.headers["set-cookie"]),
    user: res.body.user,
  };
}

export async function loginAs(role: Role = "operator") {
  const { user, password } = await createTestUser({ role });
  return login(user.email, password);
}

export function extractRefreshCookie(setCookieHeader: string | string[] | undefined): string {
  const cookies = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : ([setCookieHeader].filter(Boolean) as string[]);
  const refresh = cookies.find((c) => c.startsWith(`${REFRESH_COOKIE}=`));
  if (!refresh) throw new Error("Refresh cookie not set");
  return refresh.split(";")[0];
}

export function authHeader(token: string): [string, string] {
  return ["Authorization", `Bearer ${token}`];
}
