"use strict";

/**
 * Removes the `categories` concept entirely:
 *   1. Drop the camelCase ghost index target ("inboundLots") and the real
 *      collection ("inboundlots") category index — whichever exists.
 *   2. $unset `categoryId` from every inboundLots document so the field
 *      no longer surfaces via the Mongoose model.
 *   3. Drop the `categories` collection.
 *
 * `down` is a no-op — once categoryId is gone we cannot reconstruct it
 * from the remaining data, and recreating an empty categories collection
 * brings no value.
 */

// MongoDB error codes we tolerate during an idempotent migration. Anything
// else (permission denied, network blip, etc.) must propagate so
// migrate-mongo doesn't mark the migration as applied while leaving the DB
// half-migrated. Source: https://www.mongodb.com/docs/manual/reference/error-codes/
const NAMESPACE_NOT_FOUND = 26; // collection (or ns) missing
const INDEX_NOT_FOUND = 27; // dropIndex on a non-existent index

module.exports = {
  async up(db) {
    // NB: migration 001 created indexes on the camelCase "inboundLots" ghost,
    // while Mongoose actually writes to "inboundlots" (lowercase pluralised
    // default). Try both.
    for (const coll of ["inboundLots", "inboundlots"]) {
      try {
        await db.collection(coll).dropIndex("orgId_1_categoryId_1_qtyAvailable_1");
      } catch (err) {
        if (err && (err.code === INDEX_NOT_FOUND || err.code === NAMESPACE_NOT_FOUND)) continue;
        throw err;
      }
    }

    await db
      .collection("inboundlots")
      .updateMany({ categoryId: { $exists: true } }, { $unset: { categoryId: "" } });

    try {
      await db.collection("categories").drop();
    } catch (err) {
      if (err && err.code === NAMESPACE_NOT_FOUND) return;
      throw err;
    }
  },

  async down() {
    // intentional no-op — see header
  },
};
