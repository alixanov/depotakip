import { describe, it, expect } from "vitest";
import { app, apiPath, authHeader, loginAs, request } from "./helpers.ts";

interface Seed {
  token: string;
  carrierId: string;
  senderId: string;
  lotId: string;
}

async function seed(): Promise<Seed> {
  const op = await loginAs("operator");
  const authOp = authHeader(op.accessToken);

  const sender = await request(app)
    .post(apiPath("/senders"))
    .set(...authOp)
    .send({ fullName: "Fin Sender", phone: "+998900000011" })
    .expect(201);
  const carrier = await request(app)
    .post(apiPath("/carriers"))
    .set(...authOp)
    .send({ firstName: "Fin", lastName: "Carrier", phone: "+905000000011" })
    .expect(201);
  const lot = await request(app)
    .post(apiPath("/lots"))
    .set(...authOp)
    .send({ senderId: sender.body.id, qtyIn: 10 })
    .expect(201);

  return {
    token: op.accessToken,
    carrierId: carrier.body.id,
    senderId: sender.body.id,
    lotId: lot.body.id,
  };
}

function shipmentBody(s: Seed, overrides: Record<string, unknown> = {}) {
  return {
    carrierId: s.carrierId,
    carrierFee: { amount: 5000, currency: "USD" },
    items: [{ lotId: s.lotId, qty: 3, senderCharge: { amount: 1200, currency: "USD" } }],
    recipient: { name: "Ali", phone: "+905551234567", addressTr: "İstanbul" },
    ...overrides,
  };
}

describe("Shipment → auto-generated transactions", () => {
  it("creates one carrier_charge + per-item sender_charge", async () => {
    const s = await seed();
    const created = await request(app)
      .post(apiPath("/shipments"))
      .set(...authHeader(s.token))
      .send(shipmentBody(s))
      .expect(201);

    const list = await request(app)
      .get(apiPath(`/transactions?shipmentId=${created.body.id}`))
      .set(...authHeader(s.token))
      .expect(200);
    expect(list.body.data).toHaveLength(2);
    const kinds = list.body.data.map((t: { kind: string }) => t.kind).sort();
    expect(kinds).toEqual(["carrier_charge", "sender_charge"]);
  });

  it("skips sender_charge when item.senderCharge is null", async () => {
    const s = await seed();
    const created = await request(app)
      .post(apiPath("/shipments"))
      .set(...authHeader(s.token))
      .send(shipmentBody(s, { items: [{ lotId: s.lotId, qty: 1 }] }))
      .expect(201);

    const list = await request(app)
      .get(apiPath(`/transactions?shipmentId=${created.body.id}`))
      .set(...authHeader(s.token))
      .expect(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].kind).toBe("carrier_charge");
  });

  it("iptal generates adjustment reversals for both charge originals", async () => {
    const s = await seed();
    const created = await request(app)
      .post(apiPath("/shipments"))
      .set(...authHeader(s.token))
      .send(shipmentBody(s))
      .expect(201);

    await request(app)
      .patch(apiPath(`/shipments/${created.body.id}/status`))
      .set(...authHeader(s.token))
      .send({ status: "iptal" })
      .expect(200);

    const list = await request(app)
      .get(apiPath(`/transactions?shipmentId=${created.body.id}`))
      .set(...authHeader(s.token))
      .expect(200);
    const adjustments = list.body.data.filter((t: { kind: string }) => t.kind === "adjustment");
    expect(adjustments).toHaveLength(2);
    expect(adjustments.every((t: { direction: string }) => t.direction === "credit")).toBe(true);
  });
});

describe("GET /transactions/balances/*", () => {
  it("carrier balance reflects the shipment charge in USD-cents", async () => {
    const s = await seed();
    await request(app)
      .post(apiPath("/shipments"))
      .set(...authHeader(s.token))
      .send(shipmentBody(s))
      .expect(201);

    const res = await request(app)
      .get(apiPath("/transactions/balances/carriers"))
      .set(...authHeader(s.token))
      .expect(200);
    const row = res.body.find((r: { counterpartyId: string }) => r.counterpartyId === s.carrierId);
    expect(row).toBeDefined();
    expect(row.balanceUsd).toBe(5000); // carrier_charge debit, no payments
  });

  it("carrier_payment credit reduces carrier balance", async () => {
    const s = await seed();
    await request(app)
      .post(apiPath("/shipments"))
      .set(...authHeader(s.token))
      .send(shipmentBody(s))
      .expect(201);

    // carrier owes us 5000 → register a 2000 payment
    await request(app)
      .post(apiPath("/transactions"))
      .set(...authHeader(s.token))
      .send({
        kind: "carrier_payment",
        counterparty: { type: "carrier", id: s.carrierId },
        amount: 2000,
        currency: "USD",
        direction: "credit",
        method: "cash",
      })
      .expect(201);

    const res = await request(app)
      .get(apiPath("/transactions/balances/carriers"))
      .set(...authHeader(s.token))
      .expect(200);
    const row = res.body.find((r: { counterpartyId: string }) => r.counterpartyId === s.carrierId);
    expect(row.debitUsd).toBe(5000);
    expect(row.creditUsd).toBe(2000);
    expect(row.balanceUsd).toBe(3000);
  });

  it("sender_payment credit reduces sender balance", async () => {
    const s = await seed();
    await request(app)
      .post(apiPath("/shipments"))
      .set(...authHeader(s.token))
      .send(shipmentBody(s))
      .expect(201);

    // sender owes us 1200 (per-item sender_charge) → register a 500 payment
    await request(app)
      .post(apiPath("/transactions"))
      .set(...authHeader(s.token))
      .send({
        kind: "sender_payment",
        counterparty: { type: "sender", id: s.senderId },
        amount: 500,
        currency: "USD",
        direction: "credit",
        method: "cash",
      })
      .expect(201);

    const res = await request(app)
      .get(apiPath("/transactions/balances/senders"))
      .set(...authHeader(s.token))
      .expect(200);
    const row = res.body.find((r: { counterpartyId: string }) => r.counterpartyId === s.senderId);
    expect(row).toBeDefined();
    expect(row.debitUsd).toBe(1200);
    expect(row.creditUsd).toBe(500);
    expect(row.balanceUsd).toBe(700);
  });
});

describe("POST /transactions — payment registration", () => {
  it("viewer cannot create", async () => {
    const s = await seed();
    const v = await loginAs("viewer");
    await request(app)
      .post(apiPath("/transactions"))
      .set(...authHeader(v.accessToken))
      .send({
        kind: "carrier_payment",
        counterparty: { type: "carrier", id: s.carrierId },
        amount: 100,
        currency: "USD",
        direction: "credit",
      })
      .expect(403);
  });

  it("rejects unknown counterparty", async () => {
    const s = await seed();
    await request(app)
      .post(apiPath("/transactions"))
      .set(...authHeader(s.token))
      .send({
        kind: "carrier_payment",
        counterparty: { type: "carrier", id: "ffffffffffffffffffffffff" },
        amount: 100,
        currency: "USD",
        direction: "credit",
      })
      .expect(400);
  });
});

describe("GET /transactions/:id/receipt.pdf", () => {
  it("returns a PDF stream", async () => {
    const s = await seed();
    const created = await request(app)
      .post(apiPath("/shipments"))
      .set(...authHeader(s.token))
      .send(shipmentBody(s))
      .expect(201);
    const list = await request(app)
      .get(apiPath(`/transactions?shipmentId=${created.body.id}`))
      .set(...authHeader(s.token))
      .expect(200);
    const txId = list.body.data[0].id as string;

    const res = await request(app)
      .get(apiPath(`/transactions/${txId}/receipt.pdf`))
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
