import request from "supertest";
import { Types } from "mongoose";
import type { SystemRoleName } from "@sadiyakargo/shared";
import { createApp } from "../src/app.ts";
import { env } from "../src/config/env.ts";
import { hash } from "../src/lib/password.ts";
import { Role } from "../src/modules/access/role.model.ts";
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
  role?: SystemRoleName;
  /** Override with a specific role id (e.g. a freshly created custom role). */
  roleId?: Types.ObjectId;
  active?: boolean;
  orgId?: Types.ObjectId;
}

export async function createTestUser(opts: CreateUserOpts = {}): Promise<{
  user: UserDoc;
  password: string;
}> {
  const password = opts.password || "Passw0rd!!";
  const email = opts.email || `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@x.io`;
  const orgId = opts.orgId || ORG_ID;
  let roleId = opts.roleId;
  if (!roleId) {
    const roleName = opts.role || "operator";
    const role = await Role.findOne({ orgId, name: roleName, isSystem: true });
    if (!role) {
      throw new Error(`System role ${roleName} not seeded — check tests/setup.ts`);
    }
    roleId = role._id;
  }
  const user = await User.create({
    orgId,
    email,
    passwordHash: await hash(password),
    fullName: opts.fullName || "Test User",
    roleId,
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

export async function loginAs(role: SystemRoleName = "operator") {
  const { user, password } = await createTestUser({ role });
  return login(user.email, password);
}

/** Look up the seeded system role id — convenient for tests that hit
 *  POST /users and need to pass a real `roleId` string. */
export async function getSystemRoleId(name: SystemRoleName, orgId = ORG_ID): Promise<string> {
  const role = await Role.findOne({ orgId, name, isSystem: true });
  if (!role) throw new Error(`System role ${name} missing`);
  return role._id.toString();
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
