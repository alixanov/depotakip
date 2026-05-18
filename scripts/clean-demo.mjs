#!/usr/bin/env node
// scripts/clean-demo.mjs
//
// Companion to seed-demo.mjs. Removes every demo-tagged document
// (notes ^[DEMO]) for the configured org. Run with the same env:
//   MONGODB_URI, DEFAULT_ORG_ID (optional), DEMO_TAG (optional).
//
// Deletes hard, not soft — demo rows have no audit value.
// Order is important: transactions first (FK to shipments), then shipments,
// then lots, then senders/carriers. `auditLog` and `notificationLog` are left
// alone — they have TTL indexes and will age out on their own.

import { MongoClient, ObjectId } from "mongodb";

if (!process.env.MONGODB_URI) {
  console.error("Missing env: MONGODB_URI");
  process.exit(1);
}

const ORG_ID = process.env.DEFAULT_ORG_ID || "000000000000000000000001";
const DEMO_TAG = process.env.DEMO_TAG || "[DEMO]";
const orgFilter = { orgId: new ObjectId(ORG_ID) };
const tagRx = new RegExp(`^${DEMO_TAG.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
const tagFilter = { notes: tagRx };

const client = await MongoClient.connect(process.env.MONGODB_URI);
try {
  const db = client.db();

  console.log(`[clean] org=${ORG_ID}  tag="${DEMO_TAG}"`);

  // Shipments first, so we can cascade transactions referencing them.
  const demoShipments = await db
    .collection("shipments")
    .find({ ...orgFilter, ...tagFilter }, { projection: { _id: 1 } })
    .toArray();
  const shipmentIds = demoShipments.map((s) => s._id);

  const txByShipment = shipmentIds.length
    ? await db
        .collection("transactions")
        .deleteMany({ ...orgFilter, shipmentId: { $in: shipmentIds } })
    : { deletedCount: 0 };

  // Also kill standalone tagged transactions (the partial payments we created).
  const txTagged = await db.collection("transactions").deleteMany({ ...orgFilter, ...tagFilter });

  const ships = shipmentIds.length
    ? await db.collection("shipments").deleteMany({ _id: { $in: shipmentIds } })
    : { deletedCount: 0 };

  // NB: Mongoose's InboundLot model writes to "inboundlots" (lowercase
  // pluralized — default). The migration created indexes on the camelCase
  // "inboundLots", which is a harmless empty ghost. Always target the real one.
  const lots = await db.collection("inboundlots").deleteMany({ ...orgFilter, ...tagFilter });
  const senders = await db.collection("senders").deleteMany({ ...orgFilter, ...tagFilter });
  const carriers = await db.collection("carriers").deleteMany({ ...orgFilter, ...tagFilter });

  console.log(`[clean] transactions (shipment-linked): ${txByShipment.deletedCount}`);
  console.log(`[clean] transactions (tagged standalone): ${txTagged.deletedCount}`);
  console.log(`[clean] shipments:                       ${ships.deletedCount}`);
  console.log(`[clean] inboundLots:                     ${lots.deletedCount}`);
  console.log(`[clean] senders:                         ${senders.deletedCount}`);
  console.log(`[clean] carriers:                        ${carriers.deletedCount}`);
} finally {
  await client.close();
}
