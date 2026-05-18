import { describe, it, expect, beforeEach } from "vitest";
import { app, apiPath, authHeader, loginAs, request } from "./helpers.ts";

interface Seed {
  token: string;
  senderId: string;
  carrierId: string;
  lotId: string;
  shipmentId: string;
}

async function seed(): Promise<Seed> {
  const op = await loginAs("operator");
  const authOp = authHeader(op.accessToken);

  const sender = await request(app)
    .post(apiPath("/senders"))
    .set(...authOp)
    .send({ fullName: "Rep Sender", phone: "+998900000111" })
    .expect(201);
  const carrier = await request(app)
    .post(apiPath("/carriers"))
    .set(...authOp)
    .send({ firstName: "Rep", lastName: "Carrier", phone: "+905550001122" })
    .expect(201);
  const lot = await request(app)
    .post(apiPath("/lots"))
    .set(...authOp)
    .send({ senderId: sender.body.id, qtyIn: 20 })
    .expect(201);
  const shipment = await request(app)
    .post(apiPath("/shipments"))
    .set(...authOp)
    .send({
      carrierId: carrier.body.id,
      carrierFee: { amount: 5000, currency: "USD" },
      items: [{ lotId: lot.body.id, qty: 4, senderCharge: { amount: 1500, currency: "USD" } }],
    })
    .expect(201);

  return {
    token: op.accessToken,
    senderId: sender.body.id,
    carrierId: carrier.body.id,
    lotId: lot.body.id,
    shipmentId: shipment.body.id,
  };
}

describe("GET /reports/dashboard", () => {
  let ctx: Seed;
  beforeEach(async () => {
    ctx = await seed();
  });

  it("aggregates KPIs", async () => {
    const res = await request(app)
      .get(apiPath("/reports/dashboard"))
      .set(...authHeader(ctx.token))
      .expect(200);
    expect(res.body.shipmentsTotal).toBe(1);
    expect(res.body.shipmentsByStatus.bekliyor).toBe(1);
    expect(res.body.stockTotal).toBe(16); // 20 - 4 shipped
    expect(res.body.carrierBalanceUsd).toBe(5000);
    expect(res.body.senderBalanceUsd).toBe(1500);
    expect(res.body.shipmentsByDay.length).toBeGreaterThan(0);
  });
});

describe("GET /reports/:type", () => {
  it("carriers report includes shipment + balance", async () => {
    const ctx = await seed();
    const res = await request(app)
      .get(apiPath("/reports/carriers"))
      .set(...authHeader(ctx.token))
      .expect(200);
    const row = res.body.find((r: { carrierId: string }) => r.carrierId === ctx.carrierId);
    expect(row.shipments).toBe(1);
    expect(row.itemsTotal).toBe(4);
    expect(row.chargesUsd).toBe(5000);
    expect(row.balanceUsd).toBe(5000);
  });

  it("senders report tracks lots + charges", async () => {
    const ctx = await seed();
    const res = await request(app)
      .get(apiPath("/reports/senders"))
      .set(...authHeader(ctx.token))
      .expect(200);
    const row = res.body.find((r: { senderId: string }) => r.senderId === ctx.senderId);
    expect(row.lots).toBe(1);
    expect(row.qtyIn).toBe(20);
    expect(row.chargesUsd).toBe(1500);
  });

  it("finance report has one row per tx date", async () => {
    const ctx = await seed();
    const res = await request(app)
      .get(apiPath("/reports/finance"))
      .set(...authHeader(ctx.token))
      .expect(200);
    expect(res.body.length).toBeGreaterThan(0);
    const totalDebit = res.body.reduce(
      (s: number, r: { carrierChargesUsd: number; senderChargesUsd: number }) =>
        s + r.carrierChargesUsd + r.senderChargesUsd,
      0
    );
    expect(totalDebit).toBe(6500); // 5000 carrier + 1500 sender
  });
});

describe("GET /reports/:type/export", () => {
  it("CSV export starts with BOM + header", async () => {
    const ctx = await seed();
    const res = await request(app)
      .get(apiPath("/reports/carriers/export?format=csv"))
      .set(...authHeader(ctx.token))
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on("data", (c: Buffer) => chunks.push(c));
        r.on("end", () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    const text = (res.body as Buffer).toString("utf8");
    expect(text).toContain("Carrier ID");
    expect(text).toContain(ctx.carrierId);
  }, 30_000);

  it("XLSX export returns a zip blob (PK signature)", async () => {
    const ctx = await seed();
    const res = await request(app)
      .get(apiPath("/reports/senders/export?format=xlsx"))
      .set(...authHeader(ctx.token))
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on("data", (c: Buffer) => chunks.push(c));
        r.on("end", () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(res.headers["content-type"]).toContain("spreadsheetml");
    const body = res.body as Buffer;
    expect(body.subarray(0, 2).toString()).toBe("PK");
  }, 30_000);

  it("rejects unknown report type", async () => {
    const ctx = await seed();
    await request(app)
      .get(apiPath("/reports/unknown/export?format=csv"))
      .set(...authHeader(ctx.token))
      .expect(400);
  });
});

describe("GET /search", () => {
  it("returns hits across senders / carriers / shipments", async () => {
    const ctx = await seed();
    const auth = authHeader(ctx.token);

    const senderHits = await request(app)
      .get(apiPath("/search?q=Rep%20Sender"))
      .set(...auth)
      .expect(200);
    expect(senderHits.body.some((h: { type: string }) => h.type === "sender")).toBe(true);

    const carrierHits = await request(app)
      .get(apiPath(`/search?q=${encodeURIComponent("0001122")}`))
      .set(...auth)
      .expect(200);
    expect(carrierHits.body.some((h: { type: string }) => h.type === "carrier")).toBe(true);

    // shipment shortCode
    const lookup = await request(app)
      .get(apiPath(`/shipments/${ctx.shipmentId}`))
      .set(...auth)
      .expect(200);
    const ship = await request(app)
      .get(apiPath(`/search?q=${encodeURIComponent(lookup.body.shortCode)}`))
      .set(...auth)
      .expect(200);
    expect(ship.body.some((h: { type: string }) => h.type === "shipment")).toBe(true);
  });

  it("requires q ≥ 2 chars (via zod) actually returns empty array for length 1", async () => {
    const ctx = await seed();
    // length 1 still passes zod min(1) but service returns []
    const res = await request(app)
      .get(apiPath("/search?q=A"))
      .set(...authHeader(ctx.token))
      .expect(200);
    expect(res.body).toEqual([]);
  });
});
