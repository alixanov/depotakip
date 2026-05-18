"use strict";

/**
 * Removes the "sender pays" concept from the data model:
 *   1. Hard-delete all transactions with kind in
 *      ["sender_charge", "sender_payment"]. Adjustments that were created
 *      to reverse those originals (reversesTransactionId pointing at one of
 *      them) become orphan — also delete them by scanning notes for the
 *      sender_charge shipment refs is unreliable, so we delete by FK.
 *   2. $unset `senderCharge` from every shipments.items[] element.
 *
 * `down` is a no-op — the original sender_charge amounts cannot be
 * reconstructed once removed.
 */
module.exports = {
  async up(db) {
    // 1a. Find originals and their direct reversals.
    const originals = await db
      .collection("transactions")
      .find({ kind: { $in: ["sender_charge", "sender_payment"] } }, { projection: { _id: 1 } })
      .toArray();
    const originalIds = originals.map((t) => t._id);

    let reversalDeleted = 0;
    if (originalIds.length > 0) {
      const r = await db
        .collection("transactions")
        .deleteMany({ reversesTransactionId: { $in: originalIds } });
      reversalDeleted = r.deletedCount;
    }

    const original = await db
      .collection("transactions")
      .deleteMany({ kind: { $in: ["sender_charge", "sender_payment"] } });

    // 2. Strip the senderCharge subfield from every shipment item.
    const items = await db
      .collection("shipments")
      .updateMany(
        { "items.senderCharge": { $exists: true } },
        { $unset: { "items.$[].senderCharge": "" } }
      );

    console.log(
      `[drop-sender-financials] tx originals deleted=${original.deletedCount}, ` +
        `tx reversals deleted=${reversalDeleted}, ` +
        `shipments touched=${items.modifiedCount}`
    );
  },

  async down() {
    // intentional no-op — see header
  },
};
