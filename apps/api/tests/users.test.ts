import { describe, it, expect } from "vitest";
import {
  ORG_ID,
  app,
  apiPath,
  authHeader,
  createTestUser,
  getSystemRoleId,
  loginAs,
  request,
} from "./helpers.ts";

describe("/users RBAC", () => {
  it("allows admin to list users", async () => {
    const admin = await loginAs("admin");
    await createTestUser({ email: "a@x.io", role: "operator" });
    await createTestUser({ email: "b@x.io", role: "viewer" });
    const res = await request(app)
      .get(apiPath("/users"))
      .set(...authHeader(admin.accessToken))
      .expect(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(3);
  });

  it("forbids operator from listing users", async () => {
    const op = await loginAs("operator");
    await request(app)
      .get(apiPath("/users"))
      .set(...authHeader(op.accessToken))
      .expect(403);
  });

  it("forbids viewer from listing users", async () => {
    const v = await loginAs("viewer");
    await request(app)
      .get(apiPath("/users"))
      .set(...authHeader(v.accessToken))
      .expect(403);
  });

  it("rejects all mutations for unauthenticated", async () => {
    await request(app).post(apiPath("/users")).send({}).expect(401);
  });
});

describe("POST /users", () => {
  it("admin can create a new user", async () => {
    const admin = await loginAs("admin");
    const operatorRoleId = await getSystemRoleId("operator");
    const res = await request(app)
      .post(apiPath("/users"))
      .set(...authHeader(admin.accessToken))
      .send({
        email: "newby@example.com",
        fullName: "New User",
        roleId: operatorRoleId,
      })
      .expect(201);
    expect(res.body.user.email).toBe("newby@example.com");
    expect(res.body.user.role.name).toBe("operator");
    expect(res.body.tempPassword).toEqual(expect.any(String));
  });

  it("rejects duplicate emails", async () => {
    const admin = await loginAs("admin");
    const operatorRoleId = await getSystemRoleId("operator");
    await createTestUser({ email: "dup@example.com" });
    await request(app)
      .post(apiPath("/users"))
      .set(...authHeader(admin.accessToken))
      .send({
        email: "dup@example.com",
        fullName: "Dup",
        roleId: operatorRoleId,
      })
      .expect(409);
  });

  it("rejects invalid roleId", async () => {
    const admin = await loginAs("admin");
    await request(app)
      .post(apiPath("/users"))
      .set(...authHeader(admin.accessToken))
      .send({
        email: "bad@example.com",
        fullName: "Bad",
        roleId: "ffffffffffffffffffffffff",
      })
      .expect(400);
  });
});

describe("PATCH /users/:id", () => {
  it("admin can change role + active flag", async () => {
    const admin = await loginAs("admin");
    const viewerRoleId = await getSystemRoleId("viewer");
    const { user } = await createTestUser({ role: "operator" });
    const res = await request(app)
      .patch(apiPath(`/users/${user._id.toString()}`))
      .set(...authHeader(admin.accessToken))
      .send({ roleId: viewerRoleId, active: false })
      .expect(200);
    expect(res.body.role.name).toBe("viewer");
    expect(res.body.active).toBe(false);
  });
});

describe("DELETE /users/:id", () => {
  it("admin can soft-delete another user", async () => {
    const admin = await loginAs("admin");
    const { user } = await createTestUser();
    await request(app)
      .delete(apiPath(`/users/${user._id.toString()}`))
      .set(...authHeader(admin.accessToken))
      .expect(200);

    await request(app)
      .get(apiPath(`/users/${user._id.toString()}`))
      .set(...authHeader(admin.accessToken))
      .expect(404);
  });

  it("admin cannot delete themselves", async () => {
    const admin = await loginAs("admin");
    await request(app)
      .delete(apiPath(`/users/${admin.user.id}`))
      .set(...authHeader(admin.accessToken))
      .expect(409);
  });

  it("data is scoped by org — cannot see other org's users", async () => {
    const admin = await loginAs("admin");
    // Create user in another org — needs a role in that org too, so seed it
    // by hand (the global setup only seeds the default org).
    const { Types } = await import("mongoose");
    const { Role } = await import("../src/modules/access/role.model.ts");
    const otherOrgId = new Types.ObjectId();
    const foreignRole = await Role.create({
      orgId: otherOrgId,
      name: "operator",
      permissions: [],
      isSystem: true,
    });
    const { user: foreign } = await createTestUser({
      orgId: otherOrgId,
      roleId: foreignRole._id,
    });
    await request(app)
      .get(apiPath(`/users/${foreign._id.toString()}`))
      .set(...authHeader(admin.accessToken))
      .expect(404);
    expect(ORG_ID).not.toEqual(otherOrgId);
  });
});

describe("POST /auth/change-password", () => {
  it("updates own password", async () => {
    const { user, password } = await createTestUser();
    const session = await loginAs("operator");
    // login as the newly-created user
    const ownSession = await request(app)
      .post(apiPath("/auth/login"))
      .send({ email: user.email, password })
      .expect(200);

    await request(app)
      .post(apiPath("/auth/change-password"))
      .set(...authHeader(ownSession.body.accessToken))
      .send({ currentPassword: password, newPassword: "BrandNewPass!" })
      .expect(200);

    // old password no longer works
    await request(app)
      .post(apiPath("/auth/login"))
      .send({ email: user.email, password })
      .expect(401);

    // new password works
    await request(app)
      .post(apiPath("/auth/login"))
      .send({ email: user.email, password: "BrandNewPass!" })
      .expect(200);

    expect(session.user.role.name).toBe("operator");
  });
});
