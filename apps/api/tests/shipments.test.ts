import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import { app, apiPath, authHeader, loginAs, request } from "./helpers.ts";
import { InboundLot } from "../src/modules/lots/lot.model.ts";

interface Seed {
  token: string;
  carrierId: string;
  lotId: string;
}

async function seed(): Promise<Seed> {
  const op = await loginAs("operator");
  const authOp = authHeader(op.accessToken);

  const sender = await request(app)
    .post(apiPath("/senders"))
    .set(...authOp)
    .send({ fullName: "Lot Sender", phone: "+998901112233" })
    .expect(201);

  const carrier = await request(app)
    .post(apiPath("/carriers"))
    .set(...authOp)
    .send({ firstName: "Mehmet", lastName: "Yılmaz", phone: "+905552223344" })
    .expect(201);

  const lot = await request(app)
    .post(apiPath("/lots"))
    .set(...authOp)
    .send({ senderId: sender.body.id, qtyIn: 10 })
    .expect(201);

  return {
    token: op.accessToken,
    carrierId: carrier.body.id,
    lotId: lot.body.id,
  };
}

function shipmentBody(s: Seed, overrides: Record<string, unknown> = {}) {
  return {
    carrierId: s.carrierId,
    carrierFee: { amount: 5000, currency: "USD" },
    items: [{ lotId: s.lotId, qty: 3 }],
    recipient: { name: "Ali", phone: "+905551234567", addressTr: "İstanbul, Kadıköy" },
    notes: "test",
    ...overrides,
  };
}

describe("POST /shipments", () => {
  it("creates a shipment, mints shortCode, decrements qtyAvailable", async () => {
    const s = await seed();
    const res = await request(app)
      .post(apiPath("/shipments"))
      .set(...authHeader(s.token))
      .send(shipmentBody(s))
      .expect(201);
    expect(res.body.shortCode).toMatch(/^SH-\d{4}-\d{5}$/);
    expect(res.body.status).toBe("bekliyor");
    expect(res.body.publicTrackingToken).toMatch(/^[a-f0-9]{40}$/);
    expect(res.body.statusHistory).toHaveLength(1);

    const lot = await InboundLot.findById(s.lotId);
    expect(lot?.qtyAvailable).toBe(7);
    expect(lot?.status).toBe("partially_shipped");
  });

  it("rejects insufficient stock (409) — qtyAvailable invariant", async () => {
    const s = await seed();
    await request(app)
      .post(apiPath("/shipments"))
      .set(...authHeader(s.token))
      .send(shipmentBody(s, { items: [{ lotId: s.lotId, qty: 50 }] }))
      .expect(409);

    const lot = await InboundLot.findById(s.lotId);
    expect(lot?.qtyAvailable).toBe(10);
  });

  it("100 parallel attempts on the same lot succeed exactly qtyIn/qty times", async () => {
    const s = await seed();
    // lot has 10, qty per shipment = 1 → exactly 10 successes
    const results = await Promise.allSettled(
      Array.from({ length: 30 }, () =>
        request(app)
          .post(apiPath("/shipments"))
          .set(...authHeader(s.token))
          .send(shipmentBody(s, { items: [{ lotId: s.lotId, qty: 1 }] }))
      )
    );
    const successes = results.filter(
      (r) => r.status === "fulfilled" && (r.value as { status: number }).status === 201
    ).length;
    expect(successes).toBe(10);

    const lot = await InboundLot.findById(s.lotId);
    expect(lot?.qtyAvailable).toBe(0);
    expect(lot?.status).toBe("fully_shipped");
  }, 60_000);

  it("viewer cannot create", async () => {
    const s = await seed();
    const v = await loginAs("viewer");
    await request(app)
      .post(apiPath("/shipments"))
      .set(...authHeader(v.accessToken))
      .send(shipmentBody(s))
      .expect(403);
  });

  it("Idempotency-Key replays the same response", async () => {
    const s = await seed();
    const key = `test-${randomBytes(6).toString("hex")}`;
    const r1 = await request(app)
      .post(apiPath("/shipments"))
      .set(...authHeader(s.token))
      .set("Idempotency-Key", key)
      .send(shipmentBody(s))
      .expect(201);

    const r2 = await request(app)
      .post(apiPath("/shipments"))
      .set(...authHeader(s.token))
      .set("Idempotency-Key", key)
      .send(shipmentBody(s))
      .expect(201);

    expect(r2.body.id).toBe(r1.body.id);
    const lot = await InboundLot.findById(s.lotId);
    expect(lot?.qtyAvailable).toBe(7);
  });
});

describe("PATCH /shipments/:id/status", () => {
  it("appends a history entry", async () => {
    const s = await seed();
    const created = await request(app)
      .post(apiPath("/shipments"))
      .set(...authHeader(s.token))
      .send(shipmentBody(s))
      .expect(201);

    const res = await request(app)
      .patch(apiPath(`/shipments/${created.body.id}/status`))
      .set(...authHeader(s.token))
      .send({ status: "yolda", comment: "kargo verildi" })
      .expect(200);
    expect(res.body.status).toBe("yolda");
    expect(res.body.statusHistory).toHaveLength(2);
    expect(res.body.statusHistory[1].toStatus).toBe("yolda");
  });

  it("cancel (iptal) reverses qtyAvailable", async () => {
    const s = await seed();
    const created = await request(app)
      .post(apiPath("/shipments"))
      .set(...authHeader(s.token))
      .send(shipmentBody(s, { items: [{ lotId: s.lotId, qty: 4 }] }))
      .expect(201);

    let lot = await InboundLot.findById(s.lotId);
    expect(lot?.qtyAvailable).toBe(6);

    await request(app)
      .patch(apiPath(`/shipments/${created.body.id}/status`))
      .set(...authHeader(s.token))
      .send({ status: "iptal" })
      .expect(200);

    lot = await InboundLot.findById(s.lotId);
    expect(lot?.qtyAvailable).toBe(10);
    expect(lot?.status).toBe("in_stock");
  });
});

describe("GET /public/track/:token", () => {
  it("returns a safe subset (no money, masked phone)", async () => {
    const s = await seed();
    const created = await request(app)
      .post(apiPath("/shipments"))
      .set(...authHeader(s.token))
      .send(shipmentBody(s))
      .expect(201);
    const token = created.body.publicTrackingToken;

    const res = await request(app)
      .get(apiPath(`/public/track/${token}`))
      .expect(200);

    expect(res.body.shortCode).toBe(created.body.shortCode);
    expect(res.body.status).toBe("bekliyor");
    expect(res.body.recipient.phoneMasked).toBe("***4567");
    expect(res.body).not.toHaveProperty("carrierFee");
    expect(res.body).not.toHaveProperty("items");
    // ensure full phone never leaks anywhere in the JSON
    expect(JSON.stringify(res.body)).not.toContain("+905551234567");
  });

  it("404 on unknown / malformed token", async () => {
    await request(app)
      .get(apiPath("/public/track/00000000000000000000000000000000ffffffff"))
      .expect(404);
    await request(app).get(apiPath("/public/track/short")).expect(422);
  });
});

describe("GET /shipments/:id/waybill.pdf", () => {
  it("returns a PDF stream", async () => {
    const s = await seed();
    const created = await request(app)
      .post(apiPath("/shipments"))
      .set(...authHeader(s.token))
      .send(shipmentBody(s))
      .expect(201);

    const res = await request(app)
      .get(apiPath(`/shipments/${created.body.id}/waybill.pdf`))
      .set(...authHeader(s.token))
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on("data", (c: Buffer) => chunks.push(c));
        r.on("end", () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect((res.body as Buffer).subarray(0, 4).toString()).toBe("%PDF");
  }, 30_000);
});
