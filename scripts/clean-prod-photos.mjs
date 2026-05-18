#!/usr/bin/env node
// scripts/clean-prod-photos.mjs
//
// Wipes ALL objects from the configured S3-compatible bucket (lot photos).
// Pairs with clean-prod.mjs so the database and storage end up consistent.
//
// Required env:
//   S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY
// Optional env:
//   S3_FORCE_PATH_STYLE  (default: true — needed for MinIO/R2/Wasabi)
//   PREFIX                limit deletion to a key prefix (e.g. "orgs/<id>/lots/")
//
// Flags:
//   --dry-run    (default) list objects only, do not delete
//   --confirm yes-delete-prod   actually delete

import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";

const required = ["S3_ENDPOINT", "S3_REGION", "S3_BUCKET", "S3_ACCESS_KEY", "S3_SECRET_KEY"];
for (const k of required) {
  if (!process.env[k]) {
    console.error(`${k} is required`);
    process.exit(1);
  }
}

const argv = process.argv.slice(2);
const isDryRun =
  !argv.includes("--confirm") || argv[argv.indexOf("--confirm") + 1] !== "yes-delete-prod";
const PREFIX = process.env.PREFIX || "";

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION,
  forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? "true") !== "false",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
});

const Bucket = process.env.S3_BUCKET;
const mode = isDryRun ? "DRY-RUN" : "DELETING";
console.log(`[${mode}] bucket=${Bucket} endpoint=${process.env.S3_ENDPOINT} prefix="${PREFIX}"`);

let ContinuationToken;
let seen = 0;
let deleted = 0;
do {
  const list = await s3.send(
    new ListObjectsV2Command({ Bucket, Prefix: PREFIX || undefined, ContinuationToken })
  );
  const objs = list.Contents ?? [];
  seen += objs.length;
  if (objs.length && !isDryRun) {
    // DeleteObjects supports up to 1000 keys per call.
    for (let i = 0; i < objs.length; i += 1000) {
      const chunk = objs.slice(i, i + 1000);
      const r = await s3.send(
        new DeleteObjectsCommand({
          Bucket,
          Delete: { Objects: chunk.map((o) => ({ Key: o.Key })), Quiet: true },
        })
      );
      const errs = r.Errors?.length ?? 0;
      deleted += chunk.length - errs;
      if (errs) console.warn(`  ${errs} delete errors:`, r.Errors);
    }
  }
  ContinuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
} while (ContinuationToken);

console.log("");
console.log(`[${mode}] objects matched: ${seen}`);
if (!isDryRun) console.log(`[${mode}] objects deleted: ${deleted}`);
if (isDryRun) {
  console.log("");
  console.log("Nothing was deleted. To execute, re-run with:");
  console.log("  node --env-file=... scripts/clean-prod-photos.mjs --confirm yes-delete-prod");
}
