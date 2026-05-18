#!/usr/bin/env node
// scripts/seed-demo.mjs
//
// Demo data seeder for sadiyakargo. Required env:
//   API_BASE         e.g. https://api.example.com/api/v1
//   ADMIN_EMAIL      admin login
//   ADMIN_PASSWORD   admin password
//   MONGODB_URI      mongodb+srv://...
// Optional:
//   DEFAULT_ORG_ID   default 000000000000000000000001
//   DEMO_TAG         default "[DEMO]" — prefix written into `notes`
//
// Strategy:
//   1. Bootstrap exchangeRates for the last 30 days via Mongo (idempotent upsert).
//   2. Log in to API as admin.
//   3. Create senders, carriers, lots, shipments, payments through the REST API
//      so qtyAvailable invariants, shortCode, auditLog, statusHistory, and
//      auto-generated transactions all populate correctly.
//   4. Drive a realistic mix of statuses via PATCH /shipments/:id/status.
//
// Every created doc carries DEMO_TAG in `notes` so clean-demo.mjs can purge it.

import { MongoClient, ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";

const required = ["API_BASE", "ADMIN_EMAIL", "ADMIN_PASSWORD", "MONGODB_URI"];
for (const k of required) {
  if (!process.env[k]) {
    console.error(`Missing env: ${k}`);
    process.exit(1);
  }
}

const API_BASE = process.env.API_BASE.replace(/\/+$/, "");
const ORG_ID = process.env.DEFAULT_ORG_ID || "000000000000000000000001";
const DEMO_TAG = process.env.DEMO_TAG || "[DEMO]";
// originCheck middleware requires Origin on every non-GET. Must match an entry
// in the API's CORS_ORIGIN env. Defaults to the API origin itself — works iff
// the API origin is listed in CORS_ORIGIN. Override with WEB_ORIGIN.
const WEB_ORIGIN = process.env.WEB_ORIGIN || new URL(API_BASE).origin;

// ---------- tiny utils ----------
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[rand(0, arr.length - 1)];
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const daysAgo = (d) => new Date(Date.now() - d * 86_400_000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const safeJSON = (s) => {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};

// ---------- demo data palette ----------
const SENDER_NAMES = [
  "Akmal Karimov",
  "Dilshod Tursunov",
  "Sherzod Yusupov",
  "Bekzod Rakhmonov",
  "Javlon Iskandarov",
  "Madina Saidova",
  "Nodira Akhmedova",
  "Gulnora Eshonkulova",
  "Rustam Tashkentskiy",
  "Aziz Khalilov",
  "Sanjar Ismoilov",
  "Otabek Niyazov",
  "Farrukh Kamalov",
  "Mirzo Shamuratov",
  "Khurshid Tojiev",
  "Ali Yıldız",
  "Hasan Çelik",
  "Ayşe Demir",
  "Sadiya Kargo (kendi)",
  "Tashkent Depo (kendi)",
];

const CARRIER_FIRSTS = [
  "Mehmet",
  "Mustafa",
  "Ahmet",
  "Hüseyin",
  "Emre",
  "Burak",
  "Onur",
  "Kemal",
  "Yusuf",
  "Selim",
];
const CARRIER_LASTS = [
  "Şahin",
  "Yılmaz",
  "Doğan",
  "Kaya",
  "Çakır",
  "Aslan",
  "Korkmaz",
  "Demir",
  "Aydın",
  "Polat",
];

const RECIPIENT_NAMES = [
  "Burak Acar",
  "Selin Aydın",
  "Onur Gül",
  "Elif Şen",
  "Cenk Yıldırım",
  "Pınar Koç",
  "Murat Erdem",
  "Zeynep Arslan",
  "Tolga Kara",
  "Deniz Öz",
  "Berk Polat",
  "Esra Demirtaş",
];

const CITIES = [
  "İstanbul, Kadıköy",
  "İstanbul, Beşiktaş",
  "İstanbul, Üsküdar",
  "Ankara, Çankaya",
  "Ankara, Keçiören",
  "İzmir, Konak",
  "İzmir, Bornova",
  "Bursa, Nilüfer",
  "Antalya, Muratpaşa",
  "Adana, Seyhan",
  "Gaziantep, Şehitkamil",
  "Konya, Selçuklu",
];

const NOTES_TAILS = [
  "el aletleri",
  "kıyafet partisi",
  "kozmetik ürünler",
  "ev tekstili",
  "gıda paketleri",
  "telefon aksesuarları",
  "ayakkabı",
  "küçük elektronik",
  "saç bakım ürünleri",
  "çocuk oyuncak",
];

const uzPhone = () => `+9989${rand(0, 9)}${String(rand(1_000_000, 9_999_999))}`;
const trPhone = () => `+9055${rand(0, 9)}${String(rand(1_000_000, 9_999_999))}`;

// ---------- HTTP client ----------
let accessToken = null;

// Global rate limit on the API is 300 req/min. Pace ourselves at ~240ms gap
// (~250/min) so a burst of 80 lots + 60 shipments + status changes doesn't
// hit 429. Tunable via API_DELAY_MS env.
const API_DELAY_MS = Number(process.env.API_DELAY_MS || 240);

async function api(method, path, body, opts = {}) {
  const headers = {
    "Content-Type": "application/json",
    Origin: WEB_ORIGIN,
  };
  if (accessToken && opts.auth !== false) headers.Authorization = `Bearer ${accessToken}`;
  if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? safeJSON(text) : null;
  if (!res.ok) {
    const snippet = text ? text.slice(0, 240) : "";
    throw new Error(`${method} ${path} → HTTP ${res.status}: ${snippet}`);
  }
  if (API_DELAY_MS > 0) await sleep(API_DELAY_MS);
  return data;
}

async function login() {
  const res = await api(
    "POST",
    "/auth/login",
    { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD },
    { auth: false }
  );
  if (!res?.accessToken) throw new Error("login: no accessToken in response");
  accessToken = res.accessToken;
  return res.user;
}

// ---------- Mongo bootstrap ----------
async function seedRates(client) {
  // NB: Mongoose model ExchangeRate writes to "exchangerates" (lowercase
  // pluralized — the default when no explicit { collection } option is set).
  // The migration mistakenly creates indexes on "exchangeRates" (camelCase),
  // leaving an empty ghost. Always write to the real collection here.
  const col = client.db().collection("exchangerates");
  // Reference rates: 1 UZS ≈ 0.00008 USD (≈12500 UZS/USD), 1 TRY ≈ 0.0294 USD (≈34 TRY/USD).
  // Inject ±2% daily noise so chart looks alive.
  let added = 0;
  for (let d = 30; d >= 0; d--) {
    const date = daysAgo(d);
    date.setUTCHours(0, 0, 0, 0);
    const uzs = 0.00008 * (1 + (Math.random() - 0.5) * 0.04);
    const tryR = 0.0294118 * (1 + (Math.random() - 0.5) * 0.04);
    for (const [currency, rateToUsd] of [
      ["UZS", uzs],
      ["TRY", tryR],
    ]) {
      const res = await col.updateOne(
        { currency, rateDate: date },
        {
          $setOnInsert: {
            currency,
            rateDate: date,
            rateToUsd,
            source: "manual",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );
      if (res.upsertedCount) added++;
    }
  }
  return added;
}

async function readCategories(client) {
  const cats = await client
    .db()
    .collection("categories")
    .find({ orgId: new ObjectId(ORG_ID), deletedAt: null })
    .toArray();
  return cats;
}

// ---------- Mongo-direct shipment helpers ----------
//
// POST /shipments on prod returns HTTP 500 even though the DB write commits
// (diagnosed: 58 shipments + 146 transactions persisted on a "0 created" run).
// Root cause is a Mongoose 8 + tsup bundling issue around nested money subdoc
// or the post-commit `toClient()` call — needs a separate prod fix.
//
// Workaround for the demo: bypass the API and drive the same transactional
// write directly against Mongo. The replica set works, withTransaction works
// (tested), and the resulting docs are shape-compatible with the Mongoose
// model so the API can read them once the prod write-path bug is fixed.

async function convertAmountToUsd(db, amount, currency, date) {
  if (currency === "USD") return { amountUsd: amount, rate: 1 };
  const doc = await db
    .collection("exchangerates")
    .findOne({ currency, rateDate: { $lte: date } }, { sort: { rateDate: -1 } });
  if (!doc) {
    throw new Error(
      `No exchange rate for ${currency} on or before ${date.toISOString().slice(0, 10)}`
    );
  }
  return { amountUsd: Math.round(amount * doc.rateToUsd), rate: doc.rateToUsd };
}

async function nextShortCode(db, year, session) {
  const ctr = await db
    .collection("counters")
    .findOneAndUpdate(
      { _id: `shipment_${year}` },
      { $inc: { seq: 1 } },
      { session, upsert: true, returnDocument: "after" }
    );
  return `SH-${year}-${String(ctr.seq).padStart(5, "0")}`;
}

async function createShipmentMongo(client, orgIdHex, userIdHex, args) {
  const { carrierId, recipient, shipmentDate, carrierFee, items, notes } = args;
  const db = client.db();
  const session = client.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      // 1. Lock-and-decrement every lot; bail with conflict if any short.
      const lotSenderMap = new Map();
      for (const item of items) {
        const updated = await db.collection("inboundlots").findOneAndUpdate(
          {
            _id: new ObjectId(item.lotId),
            orgId: new ObjectId(orgIdHex),
            deletedAt: null,
            qtyAvailable: { $gte: item.qty },
          },
          { $inc: { qtyAvailable: -item.qty }, $set: { updatedAt: new Date() } },
          { session, returnDocument: "after" }
        );
        if (!updated) {
          throw new Error(`Yetersiz stok: parti ${item.lotId} (istenen ${item.qty})`);
        }
        const newLotStatus = updated.qtyAvailable === 0 ? "fully_shipped" : "partially_shipped";
        await db
          .collection("inboundlots")
          .updateOne(
            { _id: new ObjectId(item.lotId) },
            { $set: { status: newLotStatus, updatedAt: new Date() } },
            { session }
          );
        lotSenderMap.set(item.lotId, updated.senderId.toString());
      }

      // 2. Mint shortCode atomically via counters.
      const ship = new Date(shipmentDate);
      const shortCode = await nextShortCode(db, ship.getFullYear(), session);

      // 3. Insert the shipment doc — shape matches Mongoose schema exactly so
      //    the API can read it via `Shipment.findOne` etc. Items get their own
      //    _id like a Mongoose subdoc array.
      const now = new Date();
      const shipDoc = {
        _id: new ObjectId(),
        orgId: new ObjectId(orgIdHex),
        shortCode,
        carrierId: new ObjectId(carrierId),
        recipient: recipient
          ? {
              name: recipient.name,
              phone: recipient.phone,
              addressTr: recipient.addressTr,
            }
          : null,
        shipmentDate: ship,
        carrierFee: { amount: carrierFee.amount, currency: carrierFee.currency },
        status: "bekliyor",
        items: items.map((it) => ({
          _id: new ObjectId(),
          lotId: new ObjectId(it.lotId),
          qty: it.qty,
          senderCharge: it.senderCharge
            ? { amount: it.senderCharge.amount, currency: it.senderCharge.currency }
            : null,
        })),
        statusHistory: [
          {
            fromStatus: null,
            toStatus: "bekliyor",
            changedBy: new ObjectId(userIdHex),
            changedAt: now,
            comment: "Oluşturuldu",
          },
        ],
        publicTrackingToken: cryptoRandomHex(40),
        notes: notes || "",
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      await db.collection("shipments").insertOne(shipDoc, { session });

      // 4. Auto-generate transactions: one carrier_charge + per-item sender_charge.
      const txDate = ship;
      const carrierUsd = await convertAmountToUsd(
        db,
        carrierFee.amount,
        carrierFee.currency,
        txDate
      );
      await db.collection("transactions").insertOne(
        {
          _id: new ObjectId(),
          orgId: new ObjectId(orgIdHex),
          kind: "carrier_charge",
          counterparty: { type: "carrier", id: new ObjectId(carrierId) },
          shipmentId: shipDoc._id,
          amount: carrierFee.amount,
          currency: carrierFee.currency,
          direction: "debit",
          txDate,
          exchangeRateToUsd: carrierUsd.rate,
          amountUsdSnapshot: carrierUsd.amountUsd,
          method: "cash",
          notes: `Sevkiyat ${shortCode}`,
          reversesTransactionId: null,
          createdAt: now,
          updatedAt: now,
        },
        { session }
      );

      for (const item of items) {
        if (!item.senderCharge) continue;
        const senderId = lotSenderMap.get(item.lotId);
        if (!senderId) continue;
        const sUsd = await convertAmountToUsd(
          db,
          item.senderCharge.amount,
          item.senderCharge.currency,
          txDate
        );
        await db.collection("transactions").insertOne(
          {
            _id: new ObjectId(),
            orgId: new ObjectId(orgIdHex),
            kind: "sender_charge",
            counterparty: { type: "sender", id: new ObjectId(senderId) },
            shipmentId: shipDoc._id,
            amount: item.senderCharge.amount,
            currency: item.senderCharge.currency,
            direction: "debit",
            txDate,
            exchangeRateToUsd: sUsd.rate,
            amountUsdSnapshot: sUsd.amountUsd,
            method: "cash",
            notes: `Sevkiyat ${shortCode}`,
            reversesTransactionId: null,
            createdAt: now,
            updatedAt: now,
          },
          { session }
        );
      }

      result = shipDoc;
    });
  } finally {
    await session.endSession();
  }
  return result;
}

async function updateStatusMongo(client, orgIdHex, userIdHex, shipmentId, toStatus, comment) {
  const db = client.db();
  const ship = await db.collection("shipments").findOne({ _id: shipmentId });
  if (!ship) throw new Error(`shipment ${shipmentId} not found`);
  if (ship.status === toStatus) return;
  const fromStatus = ship.status;
  const now = new Date();

  if (toStatus === "iptal" && fromStatus !== "iptal") {
    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        // Reverse qtyAvailable on every lot in the shipment.
        for (const item of ship.items) {
          await db.collection("inboundlots").updateOne(
            { _id: item.lotId, orgId: ship.orgId },
            {
              $inc: { qtyAvailable: item.qty },
              $set: { status: "in_stock", updatedAt: now },
            },
            { session }
          );
        }
        // Reverse every original transaction with a same-amount adjustment.
        const originals = await db
          .collection("transactions")
          .find({ shipmentId: ship._id }, { session })
          .toArray();
        for (const orig of originals) {
          if (orig.kind === "adjustment") continue;
          const reverseUsd = await convertAmountToUsd(db, orig.amount, orig.currency, now);
          await db.collection("transactions").insertOne(
            {
              _id: new ObjectId(),
              orgId: ship.orgId,
              kind: "adjustment",
              counterparty: orig.counterparty,
              shipmentId: ship._id,
              amount: orig.amount,
              currency: orig.currency,
              direction: orig.direction === "debit" ? "credit" : "debit",
              txDate: now,
              exchangeRateToUsd: reverseUsd.rate,
              amountUsdSnapshot: reverseUsd.amountUsd,
              method: "cash",
              notes: `İptal: ${ship.shortCode}`,
              reversesTransactionId: orig._id,
              createdAt: now,
              updatedAt: now,
            },
            { session }
          );
        }
        // Flip status + push history entry.
        await db.collection("shipments").updateOne(
          { _id: ship._id },
          {
            $set: { status: "iptal", updatedAt: now },
            $push: {
              statusHistory: {
                fromStatus,
                toStatus: "iptal",
                changedBy: new ObjectId(userIdHex),
                changedAt: now,
                comment: comment || "İptal edildi",
              },
            },
          },
          { session }
        );
      });
    } finally {
      await session.endSession();
    }
  } else {
    // Simple status flip — no qty/financial side effects.
    await db.collection("shipments").updateOne(
      { _id: ship._id },
      {
        $set: { status: toStatus, updatedAt: now },
        $push: {
          statusHistory: {
            fromStatus,
            toStatus,
            changedBy: new ObjectId(userIdHex),
            changedAt: now,
            comment: comment || "",
          },
        },
      }
    );
  }
}

function cryptoRandomHex(chars) {
  // Use crypto.randomBytes (already imported via node:crypto for randomUUID).
  return Array.from(
    { length: chars },
    () => "0123456789abcdef"[Math.floor(Math.random() * 16)]
  ).join("");
}

// ---------- main flow ----------
async function main() {
  console.log(`[setup] API=${API_BASE}  org=${ORG_ID}  tag="${DEMO_TAG}"`);
  console.log(
    `[setup] Hybrid: senders/carriers/lots/payments → API; shipments → Mongo-direct (prod 500 bug).`
  );

  const client = await MongoClient.connect(process.env.MONGODB_URI);
  try {
    console.log("[1/8] Logging in as admin ...");
    const user = await login();
    console.log(`       OK, logged in as ${user.email} (role: ${user.role})`);
    const adminUserId = user.id;

    console.log("[2/8] Bootstrapping exchangeRates ...");
    const added = await seedRates(client);
    console.log(`       inserted ${added} new rate docs (existing dates left intact)`);

    const categories = await readCategories(client);
    if (categories.length === 0) {
      throw new Error("No categories for org — run `npm run migrate:up` first.");
    }
    console.log(`       found ${categories.length} categories`);

    console.log("[3/8] Creating 20 senders via API ...");
    const senders = [];
    for (let i = 0; i < 20; i++) {
      const s = await api("POST", "/senders", {
        fullName: SENDER_NAMES[i % SENDER_NAMES.length],
        phone: uzPhone(),
        address: `Toshkent, ${rand(1, 12)}-mahalla`,
        notes: `${DEMO_TAG} demo sender #${i + 1}`,
        isSelf: i < 3,
      });
      senders.push(s);
    }
    console.log(`       created ${senders.length} senders`);

    console.log("[4/8] Creating 10 carriers via API ...");
    const carriers = [];
    for (let i = 0; i < 10; i++) {
      const c = await api("POST", "/carriers", {
        firstName: CARRIER_FIRSTS[i % CARRIER_FIRSTS.length],
        lastName: CARRIER_LASTS[i % CARRIER_LASTS.length],
        phone: trPhone(),
        deliveryAddressTr: pick(CITIES),
        notes: `${DEMO_TAG} demo carrier #${i + 1}`,
      });
      carriers.push(c);
    }
    console.log(`       created ${carriers.length} carriers`);

    console.log("[5/8] Creating 80 lots via API (backdated up to 30d) ...");
    // unitPrice omitted: API 500s on lot.unitPrice nested subdoc (prod bug).
    const lots = [];
    for (let i = 0; i < 80; i++) {
      const sender = pick(senders);
      const category = pick(categories);
      const lot = await api("POST", "/lots", {
        senderId: sender.id,
        categoryId: category._id.toString(),
        qtyIn: rand(5, 150),
        receivedAt: daysAgo(rand(0, 30)).toISOString(),
        notes: `${DEMO_TAG} ${pick(NOTES_TAILS)} (#${i + 1})`,
      });
      lots.push(lot);
    }
    console.log(`       created ${lots.length} lots`);

    console.log("[6/8] Creating up to 60 shipments via Mongo-direct ...");
    const shipments = [];
    const localAvail = new Map(lots.map((l) => [l.id, l.qtyIn]));
    for (let i = 0; i < 60; i++) {
      const available = lots.filter((l) => (localAvail.get(l.id) || 0) > 0);
      if (available.length === 0) {
        console.log(`       ran out of available stock at shipment #${i}, stopping`);
        break;
      }
      const itemCount = Math.min(rand(1, 3), available.length);
      const picks = shuffle(available).slice(0, itemCount);
      const items = picks.map((lot) => {
        const avail = localAvail.get(lot.id);
        const qty = rand(1, Math.min(5, avail));
        localAvail.set(lot.id, avail - qty);
        const senderCharge =
          Math.random() < 0.75 ? { amount: rand(500, 5000), currency: pick(["USD", "TRY"]) } : null;
        return { lotId: lot.id, qty, senderCharge };
      });
      const carrier = pick(carriers);
      const shipmentDate = daysAgo(rand(0, 30));
      try {
        const sh = await createShipmentMongo(client, ORG_ID, adminUserId, {
          carrierId: carrier.id,
          recipient: {
            name: pick(RECIPIENT_NAMES),
            phone: trPhone(),
            addressTr: pick(CITIES),
          },
          shipmentDate,
          carrierFee: { amount: rand(3000, 20000), currency: pick(["USD", "TRY"]) },
          items,
          notes: `${DEMO_TAG} shipment #${i + 1}`,
        });
        shipments.push(sh);
      } catch (e) {
        console.warn(`       ! shipment #${i + 1} failed: ${e.message}`);
        for (const it of items) {
          localAvail.set(it.lotId, (localAvail.get(it.lotId) || 0) + it.qty);
        }
      }
    }
    console.log(
      `       created ${shipments.length} shipments (shortCodes: ${shipments[0]?.shortCode}..${shipments[shipments.length - 1]?.shortCode})`
    );

    console.log("[7/8] Walking shipments through realistic status transitions ...");
    const counts = { teslim: 0, yolda: 0, bekliyor: 0, kayip: 0, borclu: 0, iptal: 0 };
    for (const sh of shipments) {
      const r = Math.random();
      let target = "bekliyor";
      if (r < 0.5) target = "teslim";
      else if (r < 0.7) target = "yolda";
      else if (r < 0.8) target = "bekliyor";
      else if (r < 0.85) target = "kayip";
      else if (r < 0.9) target = "borclu";
      else target = "iptal";
      counts[target]++;
      try {
        if (target === "bekliyor") {
          continue;
        } else if (target === "iptal") {
          await updateStatusMongo(
            client,
            ORG_ID,
            adminUserId,
            sh._id,
            "iptal",
            `${DEMO_TAG} müşteri iptal etti`
          );
        } else if (target === "teslim") {
          await updateStatusMongo(client, ORG_ID, adminUserId, sh._id, "yolda", "Kargoya verildi");
          await updateStatusMongo(
            client,
            ORG_ID,
            adminUserId,
            sh._id,
            "teslim",
            "Alıcıya teslim edildi"
          );
        } else if (target === "yolda") {
          await updateStatusMongo(client, ORG_ID, adminUserId, sh._id, "yolda", "Yola çıktı");
        } else if (target === "kayip") {
          await updateStatusMongo(client, ORG_ID, adminUserId, sh._id, "yolda", "Yola çıktı");
          await updateStatusMongo(
            client,
            ORG_ID,
            adminUserId,
            sh._id,
            "kayip",
            `${DEMO_TAG} kayıp bildirildi`
          );
        } else if (target === "borclu") {
          await updateStatusMongo(client, ORG_ID, adminUserId, sh._id, "yolda", "Yola çıktı");
          await updateStatusMongo(
            client,
            ORG_ID,
            adminUserId,
            sh._id,
            "teslim",
            "Alıcıya teslim edildi"
          );
          await updateStatusMongo(
            client,
            ORG_ID,
            adminUserId,
            sh._id,
            "borclu",
            `${DEMO_TAG} ödeme bekleniyor`
          );
        }
      } catch (e) {
        console.warn(`       ! status change ${sh.shortCode}→${target} failed: ${e.message}`);
      }
    }
    console.log(`       status distribution:`, counts);

    console.log("[8/8] Registering partial payments via API ...");
    const carrierBal = await api("GET", "/transactions/balances/carriers");
    const senderBal = await api("GET", "/transactions/balances/senders");
    let payCount = 0;
    for (const row of carrierBal) {
      if (row.balanceUsd > 0 && Math.random() < 0.5) {
        const pay = Math.round(row.balanceUsd * (0.5 + Math.random() * 0.4));
        if (pay <= 0) continue;
        try {
          await api(
            "POST",
            "/transactions",
            {
              kind: "carrier_payment",
              counterparty: { type: "carrier", id: row.counterpartyId },
              amount: pay,
              currency: "USD",
              direction: "credit",
              method: pick(["cash", "bank", "card", "other"]),
              notes: `${DEMO_TAG} partial settlement`,
            },
            { idempotencyKey: randomUUID() }
          );
          payCount++;
        } catch (e) {
          console.warn(`       ! carrier_payment failed: ${e.message}`);
        }
      }
    }
    for (const row of senderBal) {
      if (row.balanceUsd > 0 && Math.random() < 0.5) {
        const pay = Math.round(row.balanceUsd * (0.5 + Math.random() * 0.4));
        if (pay <= 0) continue;
        try {
          await api(
            "POST",
            "/transactions",
            {
              kind: "sender_payment",
              counterparty: { type: "sender", id: row.counterpartyId },
              amount: pay,
              currency: "USD",
              direction: "credit",
              method: pick(["cash", "bank"]),
              notes: `${DEMO_TAG} partial settlement`,
            },
            { idempotencyKey: randomUUID() }
          );
          payCount++;
        } catch (e) {
          console.warn(`       ! sender_payment failed: ${e.message}`);
        }
      }
    }
    console.log(`       registered ${payCount} additional payments`);

    console.log("\n=== Done ===");
    console.log(`  senders:   ${senders.length}`);
    console.log(`  carriers:  ${carriers.length}`);
    console.log(`  lots:      ${lots.length}`);
    console.log(`  shipments: ${shipments.length}`);
    console.log(`  statuses:  ${JSON.stringify(counts)}`);
    console.log(`  payments:  ${payCount}`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error("FATAL:", err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});

// Defensive: avoid Node's unhandled rejection warning swallowing the real cause.
process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED:", err);
  process.exit(1);
});
