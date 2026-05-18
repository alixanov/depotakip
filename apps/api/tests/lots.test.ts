import { describe, it, expect, beforeEach, vi } from "vitest";
import sharp from "sharp";
import { app, apiPath, authHeader, loginAs, request } from "./helpers.ts";
import type { SystemRoleName } from "@sadiyakargo/shared";

// In-memory replacement for src/lib/storage.ts. Lets us assert puts/deletes
// happen without touching MinIO/S3. Defined via vi.hoisted so the same Map
// is shared between the mock and the test bodies after vi.mock hoists.
const { fakeStore } = vi.hoisted(() => ({
  fakeStore: new Map<string, Buffer>(),
}));

vi.mock("../src/lib/storage.ts", () => ({
  putObject: async (key: string, body: Buffer) => {
    fakeStore.set(key, body);
  },
  getPresignedGetUrl: async (key: string) => `https://mock-s3.local/${key}?sig=fake`,
  deleteObject: async (key: string) => {
    fakeStore.delete(key);
  },
  buildLotPhotoKey: (orgId: string, lotId: string, photoId: string) =>
    `orgs/${orgId}/lots/${lotId}/photos/${photoId}.jpg`,
}));

interface SeedResult {
  token: string;
  senderId: string;
}

async function seed(role: SystemRoleName = "operator"): Promise<SeedResult> {
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

  return { token: session.accessToken, senderId: sender.body.id };
}

describe("/lots", () => {
  let ctx: SeedResult;
  beforeEach(async () => {
    ctx = await seed("operator");
    fakeStore.clear();
  });

  it("rejects viewer create", async () => {
    const v = await loginAs("viewer");
    await request(app)
      .post(apiPath("/lots"))
      .set(...authHeader(v.accessToken))
      .send({ senderId: ctx.senderId, qtyIn: 10 })
      .expect(403);
  });

  it("operator can create + qtyAvailable mirrors qtyIn", async () => {
    const res = await request(app)
      .post(apiPath("/lots"))
      .set(...authHeader(ctx.token))
      .send({ senderId: ctx.senderId, qtyIn: 20, notes: "test" })
      .expect(201);
    expect(res.body.qtyIn).toBe(20);
    expect(res.body.qtyAvailable).toBe(20);
    expect(res.body.status).toBe("in_stock");
    expect(res.body.photos).toEqual([]);
  });

  it("rejects unknown sender", async () => {
    await request(app)
      .post(apiPath("/lots"))
      .set(...authHeader(ctx.token))
      .send({ senderId: "ffffffffffffffffffffffff", qtyIn: 5 })
      .expect(400);
  });

  it("filters by sender / available", async () => {
    const auth = authHeader(ctx.token);
    for (let i = 0; i < 3; i += 1) {
      await request(app)
        .post(apiPath("/lots"))
        .set(...auth)
        .send({ senderId: ctx.senderId, qtyIn: 5 })
        .expect(201);
    }
    const list = await request(app)
      .get(apiPath(`/lots?senderId=${ctx.senderId}&available=true`))
      .set(...auth)
      .expect(200);
    expect(list.body.data.length).toBe(3);
    expect(list.body.pagination.total).toBe(3);
  });

  it("update mutates label + notes only", async () => {
    const created = await request(app)
      .post(apiPath("/lots"))
      .set(...authHeader(ctx.token))
      .send({ senderId: ctx.senderId, qtyIn: 7 })
      .expect(201);

    const updated = await request(app)
      .patch(apiPath(`/lots/${created.body.id}`))
      .set(...authHeader(ctx.token))
      .send({ label: "Sonbahar montları", notes: "yeni not" })
      .expect(200);
    expect(updated.body.label).toBe("Sonbahar montları");
    expect(updated.body.notes).toBe("yeni not");
    expect(updated.body.qtyIn).toBe(7);
  });

  it("create accepts optional label + unitPrice", async () => {
    const res = await request(app)
      .post(apiPath("/lots"))
      .set(...authHeader(ctx.token))
      .send({
        senderId: ctx.senderId,
        label: "Sonbahar montları",
        qtyIn: 12,
        unitPrice: { amount: 1500, currency: "USD" },
      })
      .expect(201);
    expect(res.body.label).toBe("Sonbahar montları");
    expect(res.body.unitPrice).toEqual({ amount: 1500, currency: "USD" });
  });

  it("create defaults label='' when omitted", async () => {
    const res = await request(app)
      .post(apiPath("/lots"))
      .set(...authHeader(ctx.token))
      .send({ senderId: ctx.senderId, qtyIn: 3 })
      .expect(201);
    expect(res.body.label).toBe("");
    expect(res.body.unitPrice).toBeNull();
  });

  it("delete works when nothing has been shipped (qtyAvailable == qtyIn)", async () => {
    const created = await request(app)
      .post(apiPath("/lots"))
      .set(...authHeader(ctx.token))
      .send({ senderId: ctx.senderId, qtyIn: 4 })
      .expect(201);

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

describe("/lots/stock/by-sender", () => {
  it("aggregates available stock per sender", async () => {
    const ctx2 = await seed("operator");
    const auth = authHeader(ctx2.token);
    await request(app)
      .post(apiPath("/lots"))
      .set(...auth)
      .send({ senderId: ctx2.senderId, qtyIn: 5 })
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

describe("/lots/:id/photos", () => {
  let ctx: SeedResult;
  let lotId: string;
  let tinyJpeg: Buffer;

  beforeEach(async () => {
    ctx = await seed("operator");
    fakeStore.clear();
    const lot = await request(app)
      .post(apiPath("/lots"))
      .set(...authHeader(ctx.token))
      .send({ senderId: ctx.senderId, qtyIn: 5 })
      .expect(201);
    lotId = lot.body.id;
    // Real 10×10 JPEG so file-type magic-byte detection passes.
    tinyJpeg = await sharp({
      create: { width: 10, height: 10, channels: 3, background: { r: 200, g: 50, b: 50 } },
    })
      .jpeg()
      .toBuffer();
  });

  it("uploads JPEGs and pushes photos with stable ids", async () => {
    const res = await request(app)
      .post(apiPath(`/lots/${lotId}/photos`))
      .set(...authHeader(ctx.token))
      .attach("photos", tinyJpeg, { filename: "a.jpg", contentType: "image/jpeg" })
      .attach("photos", tinyJpeg, { filename: "b.jpg", contentType: "image/jpeg" })
      .expect(201);
    expect(res.body.photos).toHaveLength(2);
    for (const p of res.body.photos) {
      expect(p.id).toMatch(/^[0-9a-f]{24}$/);
      expect(p.mimeType).toBe("image/jpeg");
      expect(p.storageKey).toContain(`lots/${lotId}/photos/${p.id}.jpg`);
      expect(fakeStore.has(p.storageKey)).toBe(true);
    }
  });

  it("rejects non-image declared mime at multer", async () => {
    await request(app)
      .post(apiPath(`/lots/${lotId}/photos`))
      .set(...authHeader(ctx.token))
      .attach("photos", Buffer.from("hello"), {
        filename: "x.txt",
        contentType: "text/plain",
      })
      .expect(415);
  });

  it("rejects image-mime liar via magic-byte check", async () => {
    const res = await request(app)
      .post(apiPath(`/lots/${lotId}/photos`))
      .set(...authHeader(ctx.token))
      .attach("photos", Buffer.from("not really a jpeg"), {
        filename: "fake.jpg",
        contentType: "image/jpeg",
      })
      .expect(422);
    expect(res.body.code).toBe("VALIDATION");
  });

  it("rejects exceeding LOT_PHOTO_MAX_COUNT", async () => {
    // Fill to the limit (10) in one shot.
    const firstReq = request(app)
      .post(apiPath(`/lots/${lotId}/photos`))
      .set(...authHeader(ctx.token));
    for (let i = 0; i < 10; i += 1) {
      firstReq.attach("photos", tinyJpeg, { filename: `p${i}.jpg`, contentType: "image/jpeg" });
    }
    const first = await firstReq.expect(201);
    expect(first.body.photos).toHaveLength(10);

    // One more should 409.
    await request(app)
      .post(apiPath(`/lots/${lotId}/photos`))
      .set(...authHeader(ctx.token))
      .attach("photos", tinyJpeg, { filename: "extra.jpg", contentType: "image/jpeg" })
      .expect(409);
  });

  it("GET returns a presigned URL with TTL metadata", async () => {
    const upload = await request(app)
      .post(apiPath(`/lots/${lotId}/photos`))
      .set(...authHeader(ctx.token))
      .attach("photos", tinyJpeg, { filename: "a.jpg", contentType: "image/jpeg" })
      .expect(201);
    const photoId = upload.body.photos[0].id;

    const res = await request(app)
      .get(apiPath(`/lots/${lotId}/photos/${photoId}`))
      .set(...authHeader(ctx.token))
      .expect(200);
    expect(res.body.url).toMatch(/^https:\/\/mock-s3\.local\//);
    expect(typeof res.body.expiresAt).toBe("string");
    expect(new Date(res.body.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("PATCH /photos/order: reorders by the provided id list", async () => {
    const upload = await request(app)
      .post(apiPath(`/lots/${lotId}/photos`))
      .set(...authHeader(ctx.token))
      .attach("photos", tinyJpeg, { filename: "a.jpg", contentType: "image/jpeg" })
      .attach("photos", tinyJpeg, { filename: "b.jpg", contentType: "image/jpeg" })
      .attach("photos", tinyJpeg, { filename: "c.jpg", contentType: "image/jpeg" })
      .expect(201);
    const ids = upload.body.photos.map((p: { id: string }) => p.id) as string[];
    const reversed = [...ids].reverse();

    const res = await request(app)
      .patch(apiPath(`/lots/${lotId}/photos/order`))
      .set(...authHeader(ctx.token))
      .send({ photoIds: reversed })
      .expect(200);
    expect(res.body.photos.map((p: { id: string }) => p.id)).toEqual(reversed);
  });

  it("PATCH /photos/order: rejects mismatched length", async () => {
    const upload = await request(app)
      .post(apiPath(`/lots/${lotId}/photos`))
      .set(...authHeader(ctx.token))
      .attach("photos", tinyJpeg, { filename: "a.jpg", contentType: "image/jpeg" })
      .attach("photos", tinyJpeg, { filename: "b.jpg", contentType: "image/jpeg" })
      .expect(201);
    const [first] = upload.body.photos as { id: string }[];

    await request(app)
      .patch(apiPath(`/lots/${lotId}/photos/order`))
      .set(...authHeader(ctx.token))
      .send({ photoIds: [first.id] })
      .expect(400);
  });

  it("PATCH /photos/order: rejects unknown id", async () => {
    const upload = await request(app)
      .post(apiPath(`/lots/${lotId}/photos`))
      .set(...authHeader(ctx.token))
      .attach("photos", tinyJpeg, { filename: "a.jpg", contentType: "image/jpeg" })
      .expect(201);

    await request(app)
      .patch(apiPath(`/lots/${lotId}/photos/order`))
      .set(...authHeader(ctx.token))
      .send({ photoIds: ["ffffffffffffffffffffffff"] })
      .expect(400);
    // Original still intact.
    const after = await request(app)
      .get(apiPath(`/lots/${lotId}`))
      .set(...authHeader(ctx.token))
      .expect(200);
    expect(after.body.photos[0].id).toBe(upload.body.photos[0].id);
  });

  it("DELETE: admin removes, operator forbidden", async () => {
    const upload = await request(app)
      .post(apiPath(`/lots/${lotId}/photos`))
      .set(...authHeader(ctx.token))
      .attach("photos", tinyJpeg, { filename: "a.jpg", contentType: "image/jpeg" })
      .expect(201);
    const photoId = upload.body.photos[0].id;
    const storageKey = upload.body.photos[0].storageKey;
    expect(fakeStore.has(storageKey)).toBe(true);

    await request(app)
      .delete(apiPath(`/lots/${lotId}/photos/${photoId}`))
      .set(...authHeader(ctx.token))
      .expect(403);

    const admin = await loginAs("admin");
    const res = await request(app)
      .delete(apiPath(`/lots/${lotId}/photos/${photoId}`))
      .set(...authHeader(admin.accessToken))
      .expect(200);
    expect(res.body.photos).toHaveLength(0);
    expect(fakeStore.has(storageKey)).toBe(false);
  });
});

describe("/lots/:id/receipt.pdf", () => {
  it("returns a PDF stream", async () => {
    const ctx2 = await seed("operator");
    const auth = authHeader(ctx2.token);
    const lot = await request(app)
      .post(apiPath("/lots"))
      .set(...auth)
      .send({ senderId: ctx2.senderId, qtyIn: 3 })
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
    expect(body.subarray(0, 4).toString()).toBe("%PDF");
  }, 30_000);
});
