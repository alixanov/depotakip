#!/usr/bin/env node
// scripts/clean-prod.mjs
//
// Wipes ALL business data from the configured Mongo database while preserving
// the access-control surface (users, roles, permissions, orgs) and Mongo's own
// metadata (migrations changelog, indexes). Use with care — there's no undo.
//
// Required env:
//   MONGODB_URI            full connection string (e.g. mongodb+srv://...)
// Optional env:
//   DEFAULT_ORG_ID         scope deletion to a single org (default: all orgs)
//
// Flags:
//   --dry-run    (default) print counts only, do not delete
//   --confirm yes-delete-prod   actually delete
//
// Collections wiped (lowercase = real Mongoose default plural; camelCase
// variants are migration-created ghosts or explicit collection names —
// listed too so we don't leave orphans):
//   senders, carriers, inboundlots, inboundLots, shipments, transactions,
//   exchangerates, exchangeRates, notificationlogs, notificationLog,
//   auditlogs, auditLog, idempotencykeys, idempotencyKeys, otps,
//   refreshtokens, refreshTokens, counters
// Collections preserved: users, roles, permissions, organizations, orgs,
//   _migrations, changelog, notificationTemplates, passwordresettokens

import { MongoClient, ObjectId } from "mongodb";

const URI = process.env.MONGODB_URI;
if (!URI) {
  console.error("MONGODB_URI is required");
  process.exit(1);
}

const argv = process.argv.slice(2);
const isDryRun =
  !argv.includes("--confirm") || argv[argv.indexOf("--confirm") + 1] !== "yes-delete-prod";
const orgId = process.env.DEFAULT_ORG_ID;
const orgFilter = orgId ? { orgId: new ObjectId(orgId) } : {};

const WIPE = [
  // Business data — real collections
  "senders",
  "carriers",
  "inboundlots",
  "shipments",
  "transactions",
  "exchangerates",
  "auditLog",
  // Sessions + sequences — users stay but get logged out, shortcode resets
  "refreshtokens",
  "counters",
  // Idempotency cache (lowercase = real one in this db)
  "idempotencykeys",
  // Empty / OTP / log siblings — wiped for completeness
  "otps",
  "notificationlogs",
  "auditlogs",
  // Camel-case ghost variants left by migrations — kept in the list so a
  // future drift doesn't leave orphans.
  "inboundLots",
  "exchangeRates",
  "notificationLog",
  "idempotencyKeys",
  "refreshTokens",
];

const client = await MongoClient.connect(URI);
try {
  const db = client.db();
  const mode = isDryRun ? "DRY-RUN" : "DELETING";
  console.log(`[${mode}] db=${db.databaseName} org=${orgId ?? "<all>"}`);
  console.log("");

  let totalSeen = 0;
  let totalDeleted = 0;
  for (const name of WIPE) {
    const coll = db.collection(name);
    const count = await coll.countDocuments(orgFilter);
    totalSeen += count;
    if (count === 0) {
      console.log(`  ${name.padEnd(22)} 0`);
      continue;
    }
    if (isDryRun) {
      console.log(`  ${name.padEnd(22)} ${count}  (would delete)`);
    } else {
      const r = await coll.deleteMany(orgFilter);
      totalDeleted += r.deletedCount;
      console.log(`  ${name.padEnd(22)} ${count} → deleted ${r.deletedCount}`);
    }
  }

  console.log("");
  console.log(`[${mode}] total documents matched: ${totalSeen}`);
  if (!isDryRun) console.log(`[${mode}] total documents deleted: ${totalDeleted}`);
  if (isDryRun) {
    console.log("");
    console.log("Nothing was deleted. To execute, re-run with:");
    console.log("  node --env-file=... scripts/clean-prod.mjs --confirm yes-delete-prod");
  }
} finally {
  await client.close();
}
