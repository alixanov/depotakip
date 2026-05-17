"use strict";

module.exports = {
  async up(db) {
    await db.collection("users").createIndex({ email: 1 }, { unique: true });
    await db.collection("users").createIndex({ orgId: 1, role: 1 });
    await db.collection("users").createIndex({ deletedAt: 1 }, { sparse: true });

    await db.collection("senders").createIndex({ orgId: 1, phone: 1 });
    await db.collection("senders").createIndex({ orgId: 1, fullName: "text" });
    await db.collection("senders").createIndex({ deletedAt: 1 }, { sparse: true });

    await db.collection("carriers").createIndex({ orgId: 1, phone: 1 });
    await db.collection("carriers").createIndex({
      orgId: 1,
      firstName: "text",
      lastName: "text",
    });
    await db.collection("carriers").createIndex({ deletedAt: 1 }, { sparse: true });

    await db
      .collection("categories")
      .createIndex(
        { orgId: 1, name: 1 },
        { unique: true, collation: { locale: "tr", strength: 2 } }
      );

    await db.collection("inboundLots").createIndex({ orgId: 1, senderId: 1, status: 1 });
    await db.collection("inboundLots").createIndex({ orgId: 1, categoryId: 1, qtyAvailable: 1 });
    await db.collection("inboundLots").createIndex({ orgId: 1, receivedAt: -1 });

    await db.collection("shipments").createIndex({ orgId: 1, carrierId: 1, status: 1 });
    await db.collection("shipments").createIndex({ orgId: 1, status: 1, shipmentDate: -1 });
    await db.collection("shipments").createIndex({ orgId: 1, shortCode: 1 }, { unique: true });
    await db.collection("shipments").createIndex({ publicTrackingToken: 1 }, { unique: true });
    await db.collection("shipments").createIndex({ "items.lotId": 1 });

    await db.collection("transactions").createIndex({
      orgId: 1,
      "counterparty.type": 1,
      "counterparty.id": 1,
      txDate: -1,
    });
    await db.collection("transactions").createIndex({ orgId: 1, shipmentId: 1 });
    await db.collection("transactions").createIndex({ orgId: 1, txDate: -1 });

    await db
      .collection("exchangeRates")
      .createIndex({ currency: 1, rateDate: -1 }, { unique: true });

    await db.collection("notificationLog").createIndex({ orgId: 1, status: 1, createdAt: -1 });
    await db
      .collection("notificationLog")
      .createIndex({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 365 });

    await db
      .collection("notificationTemplates")
      .createIndex({ orgId: 1, key: 1, channel: 1, language: 1 }, { unique: true });

    await db.collection("auditLog").createIndex({ orgId: 1, at: -1 });
    await db.collection("auditLog").createIndex({ entityType: 1, entityId: 1 });
    await db
      .collection("auditLog")
      .createIndex({ at: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 365 * 2 });

    await db.collection("idempotencyKeys").createIndex({ key: 1, userId: 1 }, { unique: true });
    await db
      .collection("idempotencyKeys")
      .createIndex({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 });

    await db.collection("refreshTokens").createIndex({ tokenId: 1 }, { unique: true });
    await db.collection("refreshTokens").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  },

  async down(db) {
    for (const collection of [
      "users",
      "senders",
      "carriers",
      "categories",
      "inboundLots",
      "shipments",
      "transactions",
      "exchangeRates",
      "notificationLog",
      "notificationTemplates",
      "auditLog",
      "idempotencyKeys",
      "refreshTokens",
    ]) {
      try {
        await db.collection(collection).dropIndexes();
      } catch {
        // collection may not exist yet
      }
    }
  },
};
