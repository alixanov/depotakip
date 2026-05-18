#!/usr/bin/env node
// One-shot diagnostic: log in, list senders/categories, POST one lot, dump everything.
import { MongoClient, ObjectId } from "mongodb";

const API_BASE = process.env.API_BASE.replace(/\/+$/, "");
const WEB_ORIGIN = process.env.WEB_ORIGIN || new URL(API_BASE).origin;
const ORG_ID = process.env.DEFAULT_ORG_ID || "000000000000000000000001";

async function api(method, path, body, token) {
  const headers = { "Content-Type": "application/json", Origin: WEB_ORIGIN };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, text };
}

const { status: ls, text: lt } = await api("POST", "/auth/login", {
  email: process.env.ADMIN_EMAIL,
  password: process.env.ADMIN_PASSWORD,
});
console.log(`[login] ${ls} ${lt.slice(0, 200)}`);
if (ls !== 200) process.exit(1);
const { accessToken, user } = JSON.parse(lt);
console.log(`[login] admin user.id=${user.id} role=${user.role}`);

// Senders that we just created
const { status: ssS, text: ssT } = await api("GET", "/senders?limit=3", undefined, accessToken);
console.log(`[senders] ${ssS}`);
const sendersBody = JSON.parse(ssT);
const sender = sendersBody.data[0];
console.log(`  first sender: id=${sender.id} fullName=${sender.fullName}`);

// Categories from API (not Mongo) — get the IDs the API authoritatively sees
const { status: csS, text: csT } = await api("GET", "/categories", undefined, accessToken);
console.log(`[categories] ${csS}`);
const cats = JSON.parse(csT);
console.log(`  count=${cats.length} first=${cats[0]?.id} (${cats[0]?.name})`);
const category = cats[0];

if (!sender || !category) {
  console.error("Cannot find sender or category from API");
  process.exit(1);
}

// Minimal lot
const body1 = {
  senderId: sender.id,
  categoryId: category.id,
  qtyIn: 5,
  notes: "[DIAG] minimal",
};
console.log(`[lot] minimal request:`, JSON.stringify(body1));
const r1 = await api("POST", "/lots", body1, accessToken);
console.log(`[lot] minimal → ${r1.status}\n${r1.text}\n`);

// With small USD unitPrice
const body2 = {
  ...body1,
  unitPrice: { amount: 5000, currency: "USD" },
  notes: "[DIAG] USD unitPrice",
};
console.log(`[lot] USD price request:`, JSON.stringify(body2));
const r2 = await api("POST", "/lots", body2, accessToken);
console.log(`[lot] USD price → ${r2.status}\n${r2.text}\n`);

// With huge UZS unitPrice (5 billion)
const body3 = {
  ...body1,
  unitPrice: { amount: 5_000_000_000, currency: "UZS" },
  notes: "[DIAG] UZS huge",
};
console.log(`[lot] UZS huge request:`, JSON.stringify(body3));
const r3 = await api("POST", "/lots", body3, accessToken);
console.log(`[lot] UZS huge → ${r3.status}\n${r3.text}\n`);

// With explicit receivedAt
const body4 = {
  ...body1,
  receivedAt: new Date(Date.now() - 5 * 86_400_000).toISOString(),
  notes: "[DIAG] with receivedAt",
};
console.log(`[lot] receivedAt request:`, JSON.stringify(body4));
const r4 = await api("POST", "/lots", body4, accessToken);
console.log(`[lot] receivedAt → ${r4.status}\n${r4.text}\n`);

// Cross-check: do these category IDs exist in Mongo with the same orgId we expect?
const mc = await MongoClient.connect(process.env.MONGODB_URI);
try {
  const db = mc.db();
  const cat = await db.collection("categories").findOne({ _id: new ObjectId(category.id) });
  console.log(`[mongo] category._id=${cat?._id} orgId=${cat?.orgId} name=${cat?.name}`);
  const adminDoc = await db.collection("users").findOne({ _id: new ObjectId(user.id) });
  console.log(`[mongo] admin orgId=${adminDoc?.orgId} (env DEFAULT_ORG_ID=${ORG_ID})`);
  const sendDoc = await db.collection("senders").findOne({ _id: new ObjectId(sender.id) });
  console.log(`[mongo] sender._id=${sendDoc?._id} orgId=${sendDoc?.orgId}`);
} finally {
  await mc.close();
}
