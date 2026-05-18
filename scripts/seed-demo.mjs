#!/usr/bin/env node
// scripts/seed-demo.mjs
//
// Demo data seeder for sadiyakargo. Tuned for LOCAL DEV by default —
// reads admin creds + MONGODB_URI from apps/api/.env when run via
// `npm run seed:demo` (which passes --env-file=apps/api/.env to Node).
//
// Env (all optional except admin creds):
//   API_BASE         default http://localhost:4000/api/v1
//   MONGODB_URI      default mongodb://localhost:27017/sadiyakargo?replicaSet=rs0
//   WEB_ORIGIN       default first entry of CORS_ORIGIN (or http://localhost:3000
//                    when API_BASE is localhost) — must satisfy api/originCheck
//   ADMIN_EMAIL      required — admin login (seeded by migration 4)
//   ADMIN_PASSWORD   required — admin password
//   DEFAULT_ORG_ID   default 000000000000000000000001
//   DEMO_TAG         default "[DEMO]" — prefix written into `notes`
//   API_DELAY_MS     default 240 — gap between API calls to stay under
//                    the global 300/min rate limit
//   DEMO_IMAGES_DIR  default <repo>/images — folder with seed photos
//                    (.jpg/.jpeg/.png/.webp). Photos are randomly attached to
//                    ~70% of lots, 1-3 each.
//
// Strategy:
//   1. Bootstrap exchangeRates for the last 30 days via Mongo (idempotent upsert).
//   2. Log in to API as admin.
//   3. Create senders, carriers, lots, shipments, status changes, and partial
//      payments through the REST API so qtyAvailable invariants, shortCode,
//      auditLog, statusHistory, and auto-generated transactions all populate
//      via the real code paths.
//   4. Upload demo photos to lots via multipart POST /lots/:id/photos.
//
// Every created doc carries DEMO_TAG in `notes` so clean-demo.mjs can purge it.

import { MongoClient } from "mongodb";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
  console.error(
    "Missing ADMIN_EMAIL / ADMIN_PASSWORD. Either set them in apps/api/.env\n" +
      "(picked up automatically by `npm run seed:demo`) or pass them inline."
  );
  process.exit(1);
}

const API_BASE = (process.env.API_BASE || "http://localhost:4000/api/v1").replace(/\/+$/, "");
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/sadiyakargo?replicaSet=rs0";
const ORG_ID = process.env.DEFAULT_ORG_ID || "000000000000000000000001";
const DEMO_TAG = process.env.DEMO_TAG || "[DEMO]";

const __dirname = dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = process.env.DEMO_IMAGES_DIR || join(__dirname, "..", "images");

// originCheck middleware requires Origin on every non-GET. Must match an entry
// in the API's CORS_ORIGIN env. Pick the first CORS_ORIGIN entry when available
// (the local apps/api/.env case); otherwise default to localhost:3000 for any
// localhost API; final fallback is the API origin itself (single-origin prod).
const WEB_ORIGIN =
  process.env.WEB_ORIGIN ||
  (process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",")[0].trim() : null) ||
  (new URL(API_BASE).hostname === "localhost" ? "http://localhost:3000" : new URL(API_BASE).origin);

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
const isoDateOnly = (date) => date.toISOString().slice(0, 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const safeJSON = (s) => {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};

// ---------- demo data palette ----------
// Mostly Uzbek names (the senders are Uzbekistan-based shippers); a small
// minority of Turkish names covers the self-shipping branch + Turkish-side
// brokers that also originate lots.
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

// Lot label tails — mix of Uzbek (latin), Russian and a few Turkish, since
// operators in the UZ warehouse label parcels in whatever they think the
// downstream Turkish recipient will recognize.
const NOTES_TAILS = [
  // UZ
  "kuzgi kurtkalar",
  "asboblar partiyasi",
  "kosmetika mahsulotlari",
  "uy to'qimachiligi",
  "oziq-ovqat to'plami",
  "telefon aksessuarlari",
  "oyoq kiyim",
  "kichik elektronika",
  "soch parvarishi mahsulotlari",
  "bolalar o'yinchoqlari",
  "ayollar sumkalari",
  "qishloq xo'jaligi asboblari",
  // RU
  "осенние куртки",
  "автозапчасти",
  "посуда керамика",
  "хозтовары",
  "детские игрушки",
  "косметика партия",
  "обувь зимняя",
  "электроника бытовая",
  // TR
  "ev tekstili",
  "saç bakım ürünleri",
];

const uzPhone = () => `+9989${rand(0, 9)}${String(rand(1_000_000, 9_999_999))}`;
const trPhone = () => `+9055${rand(0, 9)}${String(rand(1_000_000, 9_999_999))}`;

// ---------- demo photos ----------
const MIME_BY_EXT = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/**
 * Loads every supported image from IMAGES_DIR into memory once. Returns
 * `{ filename, mime, buffer }[]`; empty array if the folder is missing or
 * contains nothing usable — in that case the photo-upload step no-ops
 * instead of failing the whole seed.
 */
async function loadDemoPhotos() {
  let entries;
  try {
    entries = await readdir(IMAGES_DIR);
  } catch (err) {
    console.warn(`[photos] skipping: cannot read ${IMAGES_DIR} (${err.code || err.message})`);
    return [];
  }
  const out = [];
  for (const name of entries) {
    const mime = MIME_BY_EXT[extname(name).toLowerCase()];
    if (!mime) continue;
    try {
      const buffer = await readFile(join(IMAGES_DIR, name));
      out.push({ filename: name, mime, buffer });
    } catch (err) {
      console.warn(`[photos] skipping ${name}: ${err.message}`);
    }
  }
  return out;
}

// ---------- HTTP client ----------
let accessToken = null;

// Global rate limit on the API is 300 req/min. Pace ourselves at ~240ms gap
// (~250/min) so a burst of 80 lots + 60 shipments + status changes doesn't
// hit 429. Tunable via API_DELAY_MS env.
const API_DELAY_MS = Number(process.env.API_DELAY_MS || 240);

class SeedApiError extends Error {
  constructor(method, path, status, code, requestId, snippet) {
    super(`${method} ${path} → HTTP ${status}${code ? ` [${code}]` : ""}: ${snippet}`);
    this.name = "SeedApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

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
    // The API's central error handler returns { error, code, requestId, fields }.
    // Surfacing all three lets a one-off "POST /shipments → 500" stand out from
    // the routine 429 churn instead of being swallowed by the catch blocks below.
    throw new SeedApiError(
      method,
      path,
      res.status,
      data?.code ?? null,
      data?.requestId ?? null,
      snippet
    );
  }
  if (API_DELAY_MS > 0) await sleep(API_DELAY_MS);
  return data;
}

/**
 * Multipart upload helper for POST /lots/:id/photos. The web client uses the
 * same field name ("photos") and content-type via FormData; we cannot reuse
 * `api()` because it forces application/json.
 */
async function uploadLotPhotos(lotId, files) {
  const form = new FormData();
  for (const f of files) {
    form.append("photos", new Blob([f.buffer], { type: f.mime }), f.filename);
  }
  const res = await fetch(`${API_BASE}/lots/${lotId}/photos`, {
    method: "POST",
    headers: {
      // Do NOT set Content-Type — fetch derives the multipart boundary itself.
      Origin: WEB_ORIGIN,
      Authorization: `Bearer ${accessToken}`,
    },
    body: form,
  });
  const text = await res.text();
  if (!res.ok) {
    const data = text ? safeJSON(text) : null;
    throw new SeedApiError(
      "POST",
      `/lots/${lotId}/photos`,
      res.status,
      data?.code ?? null,
      data?.requestId ?? null,
      text.slice(0, 240)
    );
  }
  if (API_DELAY_MS > 0) await sleep(API_DELAY_MS);
  return safeJSON(text);
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

// ---------- main flow ----------
async function main() {
  console.log(`[setup] API=${API_BASE}  origin=${WEB_ORIGIN}  org=${ORG_ID}  tag="${DEMO_TAG}"`);

  const client = await MongoClient.connect(MONGODB_URI);
  try {
    console.log("[1/9] Logging in as admin ...");
    const user = await login();
    console.log(`       OK, logged in as ${user.email} (role: ${user.role?.name ?? user.role})`);

    console.log("[2/9] Bootstrapping exchangeRates ...");
    const added = await seedRates(client);
    console.log(`       inserted ${added} new rate docs (existing dates left intact)`);

    console.log("[3/9] Loading demo photos ...");
    const demoPhotos = await loadDemoPhotos();
    console.log(
      demoPhotos.length
        ? `       loaded ${demoPhotos.length} image(s) from ${IMAGES_DIR}`
        : `       no images found in ${IMAGES_DIR} — lots will be created without photos`
    );

    console.log("[4/9] Creating 20 senders via API ...");
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

    console.log("[5/9] Creating 10 carriers via API ...");
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

    console.log("[6/9] Creating 80 lots via API (backdated up to 30d) ...");
    const lots = [];
    for (let i = 0; i < 80; i++) {
      const sender = pick(senders);
      const tail = pick(NOTES_TAILS);
      // Label = "<sender first name> — <tail phrase>" (UZ/RU/TR mix).
      const label = `${sender.fullName.split(" ")[0]} — ${tail}`;
      // unitPrice realistic per currency: USD $5–$80 → 500–8000 cents,
      // TRY ₺50–₺2000 → 5000–200000 kuruş, UZS 50k–2M soum → 5M–200M tiyin.
      const currency = pick(["USD", "TRY", "UZS"]);
      const unitPriceMinor =
        currency === "USD"
          ? rand(500, 8000)
          : currency === "TRY"
            ? rand(5000, 200000)
            : rand(5_000_000, 200_000_000);
      const lot = await api("POST", "/lots", {
        senderId: sender.id,
        label,
        qtyIn: rand(5, 150),
        unitPrice: { amount: unitPriceMinor, currency },
        receivedAt: daysAgo(rand(0, 30)).toISOString(),
        notes: `${DEMO_TAG} ${tail} (#${i + 1})`,
      });
      lots.push(lot);
    }
    console.log(`       created ${lots.length} lots`);

    console.log("[7/9] Attaching photos to lots ...");
    let lotsWithPhotos = 0;
    let photoFailReal = 0;
    if (demoPhotos.length === 0) {
      console.log("       skipped — no demo images available");
    } else {
      for (const lot of lots) {
        // ~70% of lots get a photo set; size = 1..min(3, available)
        if (Math.random() >= 0.7) continue;
        const count = rand(1, Math.min(3, demoPhotos.length));
        const picks = shuffle(demoPhotos).slice(0, count);
        try {
          await uploadLotPhotos(lot.id, picks);
          lotsWithPhotos++;
        } catch (e) {
          if (e.status !== 429) photoFailReal++;
          console.warn(
            `       ! photo upload for ${lot.id} failed: status=${e.status ?? "?"} code=${e.code ?? "?"} :: ${e.message}`
          );
        }
      }
      console.log(`       attached photos to ${lotsWithPhotos}/${lots.length} lots`);
      // Same 10% threshold as shipments below — anything more than that
      // signals an upload-pipeline problem worth investigating.
      if (lotsWithPhotos > 0 && photoFailReal / Math.max(1, lotsWithPhotos + photoFailReal) > 0.1) {
        console.error(
          `[warn] ${photoFailReal} non-429 photo upload failures — check the API logs.`
        );
      }
    }

    console.log("[8/9] Creating up to 60 shipments via API ...");
    const shipments = [];
    // 429 from the global rate limit is expected churn; everything else
    // (validation, 500, etc.) is a real bug we should surface — count
    // non-rate-limit failures and abort if the rate is suspiciously high.
    let shipFailReal = 0;
    let shipAttempted = 0;
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
      // shipmentDate must be YYYY-MM-DD (zod .date(), not .datetime()).
      const shipmentDate = isoDateOnly(daysAgo(rand(0, 30)));
      try {
        const sh = await api(
          "POST",
          "/shipments",
          {
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
          },
          { idempotencyKey: randomUUID() }
        );
        shipments.push(sh);
        shipAttempted++;
      } catch (e) {
        shipAttempted++;
        if (e.status !== 429) shipFailReal++;
        console.warn(
          `       ! shipment #${i + 1} failed: status=${e.status ?? "?"} code=${e.code ?? "?"} reqId=${e.requestId ?? "-"} :: ${e.message}`
        );
        // Roll back local-availability bookkeeping so subsequent picks stay sane.
        for (const it of items) {
          localAvail.set(it.lotId, (localAvail.get(it.lotId) || 0) + it.qty);
        }
      }
    }
    console.log(
      `       created ${shipments.length} shipments (shortCodes: ${shipments[0]?.shortCode}..${shipments[shipments.length - 1]?.shortCode})`
    );
    // Fail loudly when something genuine breaks. Rate-limit (429) churn is
    // tolerated; anything else above the 10% threshold means the seed should
    // not be reported as "successful" with a green prompt.
    if (shipAttempted > 0 && shipFailReal / shipAttempted > 0.1) {
      console.error(
        `[fatal] ${shipFailReal}/${shipAttempted} shipment-creates failed with non-429 errors — aborting.`
      );
      process.exit(1);
    }

    console.log("       Walking shipments through realistic status transitions ...");
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
          await api("PATCH", `/shipments/${sh.id}/status`, {
            status: "iptal",
            comment: `${DEMO_TAG} müşteri iptal etti`,
          });
        } else if (target === "teslim") {
          await api("PATCH", `/shipments/${sh.id}/status`, {
            status: "yolda",
            comment: "Kargoya verildi",
          });
          await api("PATCH", `/shipments/${sh.id}/status`, {
            status: "teslim",
            comment: "Alıcıya teslim edildi",
          });
        } else if (target === "yolda") {
          await api("PATCH", `/shipments/${sh.id}/status`, {
            status: "yolda",
            comment: "Yola çıktı",
          });
        } else if (target === "kayip") {
          await api("PATCH", `/shipments/${sh.id}/status`, {
            status: "yolda",
            comment: "Yola çıktı",
          });
          await api("PATCH", `/shipments/${sh.id}/status`, {
            status: "kayip",
            comment: `${DEMO_TAG} kayıp bildirildi`,
          });
        } else if (target === "borclu") {
          await api("PATCH", `/shipments/${sh.id}/status`, {
            status: "yolda",
            comment: "Yola çıktı",
          });
          await api("PATCH", `/shipments/${sh.id}/status`, {
            status: "teslim",
            comment: "Alıcıya teslim edildi",
          });
          await api("PATCH", `/shipments/${sh.id}/status`, {
            status: "borclu",
            comment: `${DEMO_TAG} ödeme bekleniyor`,
          });
        }
      } catch (e) {
        console.warn(`       ! status change ${sh.shortCode}→${target} failed: ${e.message}`);
      }
    }
    console.log(`       status distribution:`, counts);

    console.log("[9/9] Registering partial payments via API ...");
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
    console.log(`  senders:        ${senders.length}`);
    console.log(`  carriers:       ${carriers.length}`);
    console.log(`  lots:           ${lots.length}`);
    console.log(`  lots w/photos:  ${lotsWithPhotos}`);
    console.log(`  shipments:      ${shipments.length}`);
    console.log(`  statuses:       ${JSON.stringify(counts)}`);
    console.log(`  payments:       ${payCount}`);
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
