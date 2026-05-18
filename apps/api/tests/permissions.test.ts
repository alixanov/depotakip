/**
 * RBAC-deny тесты — проверяют, что роль БЕЗ конкретного permission получает
 * 403 на соответствующий маршрут. Системные роли (admin/operator/viewer)
 * имеют все *:read по умолчанию, поэтому тестам нужна кастомная роль без
 * соответствующего permission'а.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  app,
  apiPath,
  authHeader,
  createTestUser,
  login,
  loginAs,
  ORG_ID,
  request,
} from "./helpers.ts";
import { Role } from "../src/modules/access/role.model.ts";

/** Создаёт кастомную роль с заданным минимальным набором permissions. */
async function makeCustomRole(name: string, permissions: string[]): Promise<string> {
  const role = await Role.create({
    orgId: ORG_ID,
    name,
    description: `test role ${name}`,
    permissions,
    isSystem: false,
  });
  return role._id.toString();
}

/** Логинит юзера с заданным набором permissions через кастомную роль. */
async function loginWith(
  permissions: string[],
  roleName = `r_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
) {
  const { Types } = await import("mongoose");
  const roleId = await makeCustomRole(roleName, permissions);
  const { user, password } = await createTestUser({ roleId: new Types.ObjectId(roleId) });
  return login(user.email, password);
}

describe("RBAC: read-permission denial", () => {
  it("GET /senders → 403 без senders:read", async () => {
    const session = await loginWith([]);
    await request(app)
      .get(apiPath("/senders"))
      .set(...authHeader(session.accessToken))
      .expect(403);
  });

  it("GET /carriers → 403 без carriers:read", async () => {
    const session = await loginWith([]);
    await request(app)
      .get(apiPath("/carriers"))
      .set(...authHeader(session.accessToken))
      .expect(403);
  });

  it("GET /lots → 403 без lots:read", async () => {
    const session = await loginWith([]);
    await request(app)
      .get(apiPath("/lots"))
      .set(...authHeader(session.accessToken))
      .expect(403);
  });

  it("GET /shipments → 403 без shipments:read", async () => {
    const session = await loginWith([]);
    await request(app)
      .get(apiPath("/shipments"))
      .set(...authHeader(session.accessToken))
      .expect(403);
  });

  it("GET /transactions → 403 без transactions:read", async () => {
    const session = await loginWith([]);
    await request(app)
      .get(apiPath("/transactions"))
      .set(...authHeader(session.accessToken))
      .expect(403);
  });

  it("GET /transactions/balances/carriers → 403 без transactions:read", async () => {
    const session = await loginWith([]);
    await request(app)
      .get(apiPath("/transactions/balances/carriers"))
      .set(...authHeader(session.accessToken))
      .expect(403);
  });

  it("GET /exchange-rates → 403 без exchange_rates:read", async () => {
    const session = await loginWith([]);
    await request(app)
      .get(apiPath("/exchange-rates"))
      .set(...authHeader(session.accessToken))
      .expect(403);
  });

  it("GET /reports/dashboard → 403 без reports:read", async () => {
    const session = await loginWith([]);
    await request(app)
      .get(apiPath("/reports/dashboard"))
      .set(...authHeader(session.accessToken))
      .expect(403);
  });

  it("GET /reports/carriers/export → 403 без reports:read", async () => {
    const session = await loginWith([]);
    await request(app)
      .get(apiPath("/reports/carriers/export?format=csv"))
      .set(...authHeader(session.accessToken))
      .expect(403);
  });

  it("системный viewer имеет ALL *:read — sanity check", async () => {
    const v = await loginAs("viewer");
    const auth = authHeader(v.accessToken);
    await request(app)
      .get(apiPath("/senders"))
      .set(...auth)
      .expect(200);
    await request(app)
      .get(apiPath("/carriers"))
      .set(...auth)
      .expect(200);
    await request(app)
      .get(apiPath("/lots"))
      .set(...auth)
      .expect(200);
    await request(app)
      .get(apiPath("/shipments"))
      .set(...auth)
      .expect(200);
    await request(app)
      .get(apiPath("/transactions"))
      .set(...auth)
      .expect(200);
    await request(app)
      .get(apiPath("/reports/dashboard"))
      .set(...auth)
      .expect(200);
  });
});

describe("RBAC: shipments:cancel enforcement", () => {
  let lotId: string;
  let carrierId: string;
  let shipmentId: string;

  beforeEach(async () => {
    // Seed: operator создаёт всё нужное для shipment'а.
    const op = await loginAs("operator");
    const auth = authHeader(op.accessToken);
    const sender = await request(app)
      .post(apiPath("/senders"))
      .set(...auth)
      .send({ fullName: "S", phone: "+998900000010" })
      .expect(201);
    const carrier = await request(app)
      .post(apiPath("/carriers"))
      .set(...auth)
      .send({ firstName: "C", lastName: "X", phone: "+905000000010" })
      .expect(201);
    const lot = await request(app)
      .post(apiPath("/lots"))
      .set(...auth)
      .send({ senderId: sender.body.id, qtyIn: 10 })
      .expect(201);
    const ship = await request(app)
      .post(apiPath("/shipments"))
      .set(...auth)
      .send({
        carrierId: carrier.body.id,
        carrierFee: { amount: 5000, currency: "USD" },
        items: [{ lotId: lot.body.id, qty: 3 }],
      })
      .expect(201);
    lotId = lot.body.id;
    carrierId = carrier.body.id;
    shipmentId = ship.body.id;
    expect(lotId).toBeDefined();
    expect(carrierId).toBeDefined();
  });

  it("write без cancel → 403 при попытке iptal", async () => {
    // Кастомная роль с lots:read + shipments:write (но БЕЗ shipments:cancel).
    const session = await loginWith(["lots:read", "shipments:read", "shipments:write"]);
    await request(app)
      .patch(apiPath(`/shipments/${shipmentId}/status`))
      .set(...authHeader(session.accessToken))
      .send({ status: "iptal" })
      .expect(403);
  });

  it("write + cancel → 200 при iptal", async () => {
    const session = await loginWith([
      "lots:read",
      "shipments:read",
      "shipments:write",
      "shipments:cancel",
    ]);
    const res = await request(app)
      .patch(apiPath(`/shipments/${shipmentId}/status`))
      .set(...authHeader(session.accessToken))
      .send({ status: "iptal" })
      .expect(200);
    expect(res.body.status).toBe("iptal");
  });

  it("write без cancel — yolda всё ещё доступен", async () => {
    const session = await loginWith(["lots:read", "shipments:read", "shipments:write"]);
    await request(app)
      .patch(apiPath(`/shipments/${shipmentId}/status`))
      .set(...authHeader(session.accessToken))
      .send({ status: "yolda" })
      .expect(200);
  });
});
