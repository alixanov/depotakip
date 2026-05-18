#!/usr/bin/env node
// One-off cleanup of [DEMO] and [DIAG] artifacts left by a partial seed.
import { MongoClient, ObjectId } from "mongodb";

const ORG_ID = process.env.DEFAULT_ORG_ID || "000000000000000000000001";
const orgFilter = { orgId: new ObjectId(ORG_ID) };
const tagRx = /^\[(DEMO|DIAG)\]/;

const client = await MongoClient.connect(process.env.MONGODB_URI);
try {
  const db = client.db();
  const ships = await db
    .collection("shipments")
    .find({ ...orgFilter, notes: tagRx }, { projection: { _id: 1 } })
    .toArray();
  const shipmentIds = ships.map((s) => s._id);

  const txCascaded = shipmentIds.length
    ? await db.collection("transactions").deleteMany({ shipmentId: { $in: shipmentIds } })
    : { deletedCount: 0 };
  const txTagged = await db.collection("transactions").deleteMany({ ...orgFilter, notes: tagRx });
  const shipDel = shipmentIds.length
    ? await db.collection("shipments").deleteMany({ _id: { $in: shipmentIds } })
    : { deletedCount: 0 };
  const lots = await db.collection("inboundlots").deleteMany({ ...orgFilter, notes: tagRx });
  const senders = await db.collection("senders").deleteMany({ ...orgFilter, notes: tagRx });
  const carriers = await db.collection("carriers").deleteMany({ ...orgFilter, notes: tagRx });

  console.log({
    txCascaded: txCascaded.deletedCount,
    txTagged: txTagged.deletedCount,
    shipments: shipDel.deletedCount,
    lots: lots.deletedCount,
    senders: senders.deletedCount,
    carriers: carriers.deletedCount,
  });
} finally {
  await client.close();
}
