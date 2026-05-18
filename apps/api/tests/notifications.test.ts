import { describe, it, expect, beforeEach } from "vitest";
import { Types } from "mongoose";
import { app, apiPath, authHeader, loginAs, ORG_ID, request } from "./helpers.ts";
import { NotificationTemplate } from "../src/modules/notifications/template.model.ts";
import { NotificationLog } from "../src/modules/notifications/log.model.ts";
import { Carrier } from "../src/modules/carriers/carrier.model.ts";
import { Sender } from "../src/modules/senders/sender.model.ts";

interface Seed {
  token: string;
  carrierId: string;
  senderId: string;
  lotId: string;
}

async function seedWithTemplates(): Promise<Seed> {
  const op = await loginAs("operator");
  const authOp = authHeader(op.accessToken);

  const sender = await request(app)
    .post(apiPath("/senders"))
    .set(...authOp)
    .send({ fullName: "Notif Sender", phone: "+998900000099" })
    .expect(201);
  await Sender.updateOne({ _id: sender.body.id }, { $set: { telegramChatId: 111 } });

  const carrier = await request(app)
    .post(apiPath("/carriers"))
    .set(...authOp)
    .send({ firstName: "Notif", lastName: "Carrier", phone: "+905000000099" })
    .expect(201);
  await Carrier.updateOne({ _id: carrier.body.id }, { $set: { telegramChatId: 222 } });

  const lot = await request(app)
    .post(apiPath("/lots"))
    .set(...authOp)
    .send({ senderId: sender.body.id, qtyIn: 10 })
    .expect(201);

  // Seed all templates we trigger in tests (migration only seeds them once per
  // real DB; in-memory tests start empty).
  for (const key of [
    "shipment_yolda",
    "shipment_teslim",
    "shipment_kayip",
    "shipment_iptal",
    "shipment_bekliyor",
    "payment_received",
  ] as const) {
    await NotificationTemplate.create({
      orgId: ORG_ID,
      key,
      channel: "telegram",
      language: "tr",
      body: `${key}: {{shortCode}} → {{trackingUrl}}`,
      active: true,
    });
  }

  return {
    token: op.accessToken,
    carrierId: carrier.body.id,
    senderId: sender.body.id,
    lotId: lot.body.id,
  };
}

describe("Notifications — templates CRUD", () => {
  it("admin can create + update + delete template", async () => {
    const admin = await loginAs("admin");
    const created = await request(app)
      .post(apiPath("/notifications/templates"))
      .set(...authHeader(admin.accessToken))
      .send({
        key: "lot_received",
        channel: "telegram",
        language: "tr",
        body: "Yeni parti: {{qty}} adet",
      })
      .expect(201);
    expect(created.body.body).toContain("{{qty}}");

    await request(app)
      .patch(apiPath(`/notifications/templates/${created.body.id}`))
      .set(...authHeader(admin.accessToken))
      .send({ active: false })
      .expect(200);

    await request(app)
      .delete(apiPath(`/notifications/templates/${created.body.id}`))
      .set(...authHeader(admin.accessToken))
      .expect(200);
  });

  it("operator forbidden to mutate templates", async () => {
    const op = await loginAs("operator");
    await request(app)
      .post(apiPath("/notifications/templates"))
      .set(...authHeader(op.accessToken))
      .send({
        key: "shipment_yolda",
        channel: "telegram",
        language: "tr",
        body: "x",
      })
      .expect(403);
  });
});

describe("Triggers", () => {
  let ctx: Seed;
  beforeEach(async () => {
    ctx = await seedWithTemplates();
  });

  it("status change enqueues telegram notifications for carrier + sender", async () => {
    const auth = authHeader(ctx.token);
    const shipment = await request(app)
      .post(apiPath("/shipments"))
      .set(...auth)
      .send({
        carrierId: ctx.carrierId,
        carrierFee: { amount: 5000, currency: "USD" },
        items: [{ lotId: ctx.lotId, qty: 2 }],
      })
      .expect(201);

    // Initial bekliyor template was seeded — already produced 2 logs (carrier+sender)
    // on shipment create? No — service only fires for `updateStatus`. So zero so far.
    const before = await NotificationLog.countDocuments({
      orgId: ORG_ID,
      templateKey: { $in: ["shipment_yolda", "shipment_teslim"] },
    });
    expect(before).toBe(0);

    await request(app)
      .patch(apiPath(`/shipments/${shipment.body.id}/status`))
      .set(...auth)
      .send({ status: "yolda" })
      .expect(200);

    const logs = await NotificationLog.find({
      orgId: ORG_ID,
      templateKey: "shipment_yolda",
    });
    expect(logs).toHaveLength(2);
    const types = logs.map((l) => l.recipientType).sort();
    expect(types).toEqual(["carrier", "sender"]);
    expect(logs.every((l) => l.status === "sent")).toBe(true);
    expect(logs[0].renderedText).toContain(shipment.body.shortCode);
  });

  it("skips telegram if recipient has no chatId", async () => {
    // Strip the chatIds we previously set.
    await Sender.updateMany(
      { _id: new Types.ObjectId(ctx.senderId) },
      { $set: { telegramChatId: null } }
    );
    await Carrier.updateMany(
      { _id: new Types.ObjectId(ctx.carrierId) },
      { $set: { telegramChatId: null } }
    );

    const auth = authHeader(ctx.token);
    const shipment = await request(app)
      .post(apiPath("/shipments"))
      .set(...auth)
      .send({
        carrierId: ctx.carrierId,
        carrierFee: { amount: 5000, currency: "USD" },
        items: [{ lotId: ctx.lotId, qty: 1 }],
      })
      .expect(201);

    await request(app)
      .patch(apiPath(`/shipments/${shipment.body.id}/status`))
      .set(...auth)
      .send({ status: "teslim" })
      .expect(200);

    const logs = await NotificationLog.countDocuments({
      orgId: ORG_ID,
      templateKey: "shipment_teslim",
    });
    expect(logs).toBe(0);
  });

  it("carrier_payment triggers payment_received notification", async () => {
    const auth = authHeader(ctx.token);

    await request(app)
      .post(apiPath("/transactions"))
      .set(...auth)
      .send({
        kind: "carrier_payment",
        counterparty: { type: "carrier", id: ctx.carrierId },
        amount: 1500,
        currency: "USD",
        direction: "credit",
        method: "cash",
      })
      .expect(201);

    const logs = await NotificationLog.find({
      orgId: ORG_ID,
      templateKey: "payment_received",
    });
    expect(logs).toHaveLength(1);
    expect(logs[0].recipientRef.chatId).toBe(222);
    expect(logs[0].status).toBe("sent");
  });
});
