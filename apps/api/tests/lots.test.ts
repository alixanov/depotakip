import { describe, it, expect, beforeEach } from "vitest";
import { app, apiPath, authHeader, loginAs, request } from "./helpers.ts";
import type { Role } from "@depotakip/shared";

interface SeedResult {
  token: string;
  senderId: string;
  categoryId: string;
}

async function seed(role: Role = "operator"): Promise<SeedResult> {
  const session = await loginAs(role);
  const auth = authHeader(session.accessToken);

  const sender = await request(app)
    .post(apiPath("/senders"))
    .set(...auth)
    .send({
      fullName: "Lot Sender",
      phone: "+998901112233",
      address: "Tashkent",
    })
    .expect(201);

  const category = await request(app)
    .post(apiPath("/categories"))
    .set(...authHeader((await loginAs("admin")).accessToken))
    .send({ name: "Test-Cat" })
    .expect(201);

  return { token: session.accessToken, senderId: sender.body.id, categoryId: category.body.id };
}

describe("/lots", () => {
  let ctx: SeedResult;
  beforeEach(async () => {
    ctx = await seed("operator");
  });

  it("rejects viewer create", async () => {
    const v = await loginAs("viewer");
    await request(app)
      .post(apiPath("/lots"))
      .set(...authHeader(v.accessToken))
      .send({
        senderId: ctx.senderId,
        categoryId: ctx.categoryId,
        qtyIn: 10,
      })
      .expect(403);
  });

  it("operator can create + qtyAvailable mirrors qtyIn", async () => {
    const res = await request(app)
      .post(apiPath("/lots"))
      .set(...authHeader(ctx.token))
      .send({
        senderId: ctx.senderId,
        categoryId: ctx.categoryId,
        qtyIn: 20,
        notes: "test",
      })
      .expect(201);
    expect(res.body.qtyIn).toBe(20);
    expect(res.body.qtyAvailable).toBe(20);
    expect(res.body.status).toBe("in_stock");
  });

  it("rejects unknown sender / category", async () => {
    await request(app)
      .post(apiPath("/lots"))
      .set(...authHeader(ctx.token))
      .send({
        senderId: "ffffffffffffffffffffffff",
        categoryId: ctx.categoryId,
        qtyIn: 5,
      })
      .expect(400);

    await request(app)
      .post(apiPath("/lots"))
      .set(...authHeader(ctx.token))
      .send({
        senderId: ctx.senderId,
        categoryId: "ffffffffffffffffffffffff",
        qtyIn: 5,
      })
      .expect(400);
  });

  it("filters by sender / category / available", async () => {
    const auth = authHeader(ctx.token);
    for (let i = 0; i < 3; i += 1) {
      await request(app)
        .post(apiPath("/lots"))
        .set(...auth)
        .send({ senderId: ctx.senderId, categoryId: ctx.categoryId, qtyIn: 5 })
        .expect(201);
    }
    const list = await request(app)
      .get(apiPath(`/lots?senderId=${ctx.senderId}&available=true`))
      .set(...auth)
      .expect(200);
    expect(list.body.data.length).toBe(3);
    expect(list.body.pagination.total).toBe(3);
  });

  it("update mutates only notes", async () => {
    const created = await request(app)
      .post(apiPath("/lots"))
      .set(...authHeader(ctx.token))
      .send({ senderId: ctx.senderId, categoryId: ctx.categoryId, qtyIn: 7 })
      .expect(201);

    const updated = await request(app)
      .patch(apiPath(`/lots/${created.body.id}`))
      .set(...authHeader(ctx.token))
      .send({ notes: "yeni not" })
      .expect(200);
    expect(updated.body.notes).toBe("yeni not");
    expect(updated.body.qtyIn).toBe(7);
  });

  it("delete works when nothing has been shipped (qtyAvailable == qtyIn)", async () => {
    const created = await request(app)
      .post(apiPath("/lots"))
      .set(...authHeader(ctx.token))
      .send({ senderId: ctx.senderId, categoryId: ctx.categoryId, qtyIn: 4 })
      .expect(201);

    // operator forbidden
    await request(app)
      .delete(apiPath(`/lots/${created.body.id}`))
      .set(...authHeader(ctx.token))
      .expect(403);

    const admin = await loginAs("admin");
    await request(app)
      .delete(apiPath(`/lots/${created.body.id}`))
      .set(...authHeader(admin.accessToken))
      .expect(200);
  });
});

describe("/lots/stock/*", () => {
  it("by-category aggregates available stock", async () => {
    const ctx2 = await seed("operator");
    const auth = authHeader(ctx2.token);
    await request(app)
      .post(apiPath("/lots"))
      .set(...auth)
      .send({ senderId: ctx2.senderId, categoryId: ctx2.categoryId, qtyIn: 12 })
      .expect(201);
    await request(app)
      .post(apiPath("/lots"))
      .set(...auth)
      .send({ senderId: ctx2.senderId, categoryId: ctx2.categoryId, qtyIn: 8 })
      .expect(201);

    const res = await request(app)
      .get(apiPath("/lots/stock/by-category"))
      .set(...auth)
      .expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].totalAvailable).toBe(20);
    expect(res.body[0].lots).toBe(2);
  });

  it("by-sender aggregates per sender", async () => {
    const ctx2 = await seed("operator");
    const auth = authHeader(ctx2.token);
    await request(app)
      .post(apiPath("/lots"))
      .set(...auth)
      .send({ senderId: ctx2.senderId, categoryId: ctx2.categoryId, qtyIn: 5 })
      .expect(201);

    const res = await request(app)
      .get(apiPath("/lots/stock/by-sender"))
      .set(...auth)
      .expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].totalAvailable).toBe(5);
    expect(res.body[0].name).toBe("Lot Sender");
  });
});

describe("/lots/:id/receipt.pdf", () => {
  it("returns a PDF stream", async () => {
    const ctx2 = await seed("operator");
    const auth = authHeader(ctx2.token);
    const lot = await request(app)
      .post(apiPath("/lots"))
      .set(...auth)
      .send({ senderId: ctx2.senderId, categoryId: ctx2.categoryId, qtyIn: 3 })
      .expect(201);

    const res = await request(app)
      .get(apiPath(`/lots/${lot.body.id}/receipt.pdf`))
      .set(...auth)
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on("data", (c: Buffer) => chunks.push(c));
        r.on("end", () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    const body = res.body as Buffer;
    // PDF files start with %PDF
    expect(body.slice(0, 4).toString()).toBe("%PDF");
  }, 30_000);
});
