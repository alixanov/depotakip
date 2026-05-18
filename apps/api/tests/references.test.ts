import { describe, it, expect } from "vitest";
import { app, apiPath, authHeader, loginAs, request } from "./helpers.ts";

describe("/senders", () => {
  const sample = {
    fullName: "Alice Sender",
    phone: "+998901112233",
    address: "Tashkent",
    notes: "",
    isSelf: false,
  };

  it("operator can create + list + update", async () => {
    const op = await loginAs("operator");
    const created = await request(app)
      .post(apiPath("/senders"))
      .set(...authHeader(op.accessToken))
      .send(sample)
      .expect(201);
    expect(created.body.fullName).toBe(sample.fullName);

    const list = await request(app)
      .get(apiPath("/senders"))
      .set(...authHeader(op.accessToken))
      .expect(200);
    expect(list.body.data.length).toBe(1);

    await request(app)
      .patch(apiPath(`/senders/${created.body.id}`))
      .set(...authHeader(op.accessToken))
      .send({ address: "İstanbul" })
      .expect(200);
  });

  it("operator cannot delete (admin only)", async () => {
    const op = await loginAs("operator");
    const created = await request(app)
      .post(apiPath("/senders"))
      .set(...authHeader(op.accessToken))
      .send(sample)
      .expect(201);

    await request(app)
      .delete(apiPath(`/senders/${created.body.id}`))
      .set(...authHeader(op.accessToken))
      .expect(403);

    const admin = await loginAs("admin");
    await request(app)
      .delete(apiPath(`/senders/${created.body.id}`))
      .set(...authHeader(admin.accessToken))
      .expect(200);
  });

  it("viewer cannot create", async () => {
    const v = await loginAs("viewer");
    await request(app)
      .post(apiPath("/senders"))
      .set(...authHeader(v.accessToken))
      .send(sample)
      .expect(403);
  });

  it("supports pagination + search by phone substring", async () => {
    const op = await loginAs("operator");
    for (let i = 0; i < 25; i += 1) {
      await request(app)
        .post(apiPath("/senders"))
        .set(...authHeader(op.accessToken))
        .send({ ...sample, fullName: `Sender ${i}`, phone: `+99890${1000 + i}` })
        .expect(201);
    }

    const page1 = await request(app)
      .get(apiPath("/senders?page=1&limit=10"))
      .set(...authHeader(op.accessToken))
      .expect(200);
    expect(page1.body.data).toHaveLength(10);
    expect(page1.body.pagination.total).toBe(25);
    expect(page1.body.pagination.hasMore).toBe(true);

    const search = await request(app)
      .get(apiPath("/senders?q=1005"))
      .set(...authHeader(op.accessToken))
      .expect(200);
    expect(search.body.data.length).toBeGreaterThan(0);
  });
});

describe("/carriers", () => {
  const sample = {
    firstName: "Bob",
    lastName: "Carrier",
    phone: "+998905552211",
    deliveryAddressTr: "İstanbul",
    notes: "",
  };

  it("operator can create + update; only admin can delete", async () => {
    const op = await loginAs("operator");
    const created = await request(app)
      .post(apiPath("/carriers"))
      .set(...authHeader(op.accessToken))
      .send(sample)
      .expect(201);
    expect(created.body.firstName).toBe("Bob");

    await request(app)
      .delete(apiPath(`/carriers/${created.body.id}`))
      .set(...authHeader(op.accessToken))
      .expect(403);

    const admin = await loginAs("admin");
    await request(app)
      .delete(apiPath(`/carriers/${created.body.id}`))
      .set(...authHeader(admin.accessToken))
      .expect(200);
  });
});

describe("/exchange-rates", () => {
  it("admin can register a rate, others cannot", async () => {
    const op = await loginAs("operator");
    await request(app)
      .post(apiPath("/exchange-rates"))
      .set(...authHeader(op.accessToken))
      .send({ currency: "UZS", rateToUsd: 0.000079, rateDate: "2026-05-18" })
      .expect(403);

    const admin = await loginAs("admin");
    const res = await request(app)
      .post(apiPath("/exchange-rates"))
      .set(...authHeader(admin.accessToken))
      .send({ currency: "UZS", rateToUsd: 0.000079, rateDate: "2026-05-18" })
      .expect(201);
    expect(res.body.currency).toBe("UZS");
  });

  it("rejects USD as foreign currency", async () => {
    const admin = await loginAs("admin");
    await request(app)
      .post(apiPath("/exchange-rates"))
      .set(...authHeader(admin.accessToken))
      .send({ currency: "USD", rateToUsd: 1, rateDate: "2026-05-18" })
      .expect(422);
  });

  it("rejects duplicate (currency, date)", async () => {
    const admin = await loginAs("admin");
    await request(app)
      .post(apiPath("/exchange-rates"))
      .set(...authHeader(admin.accessToken))
      .send({ currency: "TRY", rateToUsd: 0.029, rateDate: "2026-05-18" })
      .expect(201);
    await request(app)
      .post(apiPath("/exchange-rates"))
      .set(...authHeader(admin.accessToken))
      .send({ currency: "TRY", rateToUsd: 0.03, rateDate: "2026-05-18" })
      .expect(409);
  });
});
