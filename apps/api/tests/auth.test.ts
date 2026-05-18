import { describe, it, expect } from "vitest";
import {
  app,
  apiPath,
  authHeader,
  createTestUser,
  extractRefreshCookie,
  login,
  loginAs,
  request,
} from "./helpers.ts";
import { REFRESH_COOKIE } from "../src/lib/cookies.ts";
import { RefreshToken } from "../src/modules/auth/refreshToken.model.ts";

describe("POST /auth/login", () => {
  it("returns access + refresh cookie", async () => {
    const { user, password } = await createTestUser({ email: "ok@example.com" });
    const res = await request(app)
      .post(apiPath("/auth/login"))
      .send({ email: "ok@example.com", password })
      .expect(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user.id).toBe(user._id.toString());
    expect(res.headers["set-cookie"][0]).toContain(REFRESH_COOKIE);
  });

  it("rejects wrong password", async () => {
    await createTestUser({ email: "bad@example.com" });
    await request(app)
      .post(apiPath("/auth/login"))
      .send({ email: "bad@example.com", password: "wrong-wrong-1" })
      .expect(401);
  });

  it("rejects inactive user", async () => {
    const { password } = await createTestUser({ email: "off@example.com", active: false });
    await request(app)
      .post(apiPath("/auth/login"))
      .send({ email: "off@example.com", password })
      .expect(401);
  });

  it("rejects unknown email without leaking existence", async () => {
    const res = await request(app)
      .post(apiPath("/auth/login"))
      .send({ email: "ghost@example.com", password: "whatever" })
      .expect(401);
    expect(res.body.code).toBe("err:invalid_credentials");
  });
});

describe("POST /auth/refresh", () => {
  it("rotates the refresh token and revokes the old one", async () => {
    const { user, password } = await createTestUser();
    const first = await login(user.email, password);

    const res = await request(app)
      .post(apiPath("/auth/refresh"))
      .set("Cookie", first.refreshCookie)
      .expect(200);

    const second = extractRefreshCookie(res.headers["set-cookie"]);
    expect(second).not.toBe(first.refreshCookie);

    const tokens = await RefreshToken.find({ userId: user._id }).sort({ issuedAt: 1 });
    expect(tokens).toHaveLength(2);
    expect(tokens[0].revokedAt).not.toBeNull();
    expect(tokens[0].replacedBy).toBe(tokens[1].tokenId);
    expect(tokens[1].revokedAt).toBeNull();
  });

  it("detects replay and revokes the whole chain", async () => {
    const { user, password } = await createTestUser();
    const first = await login(user.email, password);

    // First legitimate refresh
    await request(app)
      .post(apiPath("/auth/refresh"))
      .set("Cookie", first.refreshCookie)
      .expect(200);

    // Replay of the original (revoked) token
    await request(app)
      .post(apiPath("/auth/refresh"))
      .set("Cookie", first.refreshCookie)
      .expect(401);

    const active = await RefreshToken.countDocuments({
      userId: user._id,
      revokedAt: null,
    });
    expect(active).toBe(0);
  });
});

describe("POST /auth/logout", () => {
  it("revokes the refresh token", async () => {
    const { user, password } = await createTestUser();
    const session = await login(user.email, password);

    await request(app)
      .post(apiPath("/auth/logout"))
      .set("Cookie", session.refreshCookie)
      .expect(200);

    const remaining = await RefreshToken.countDocuments({
      userId: user._id,
      revokedAt: null,
    });
    expect(remaining).toBe(0);
  });
});

describe("GET /auth/me", () => {
  it("returns the authenticated user", async () => {
    const session = await loginAs("operator");
    const res = await request(app)
      .get(apiPath("/auth/me"))
      .set(...authHeader(session.accessToken))
      .expect(200);
    expect(res.body.user.id).toBe(session.user.id);
    expect(res.body.user.role.name).toBe("operator");
  });

  it("rejects when missing token", async () => {
    await request(app).get(apiPath("/auth/me")).expect(401);
  });
});

describe("POST /auth/forgot-password", () => {
  it("never leaks whether the email exists", async () => {
    const r1 = await request(app)
      .post(apiPath("/auth/forgot-password"))
      .send({ email: "nobody@example.com" })
      .expect(200);
    expect(r1.body).toEqual({ ok: true });

    await createTestUser({ email: "real@example.com" });
    const r2 = await request(app)
      .post(apiPath("/auth/forgot-password"))
      .send({ email: "real@example.com" })
      .expect(200);
    expect(r2.body).toEqual({ ok: true });
  });
});
