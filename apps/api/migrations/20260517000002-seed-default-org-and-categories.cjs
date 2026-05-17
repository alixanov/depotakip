"use strict";

const { ObjectId } = require("mongodb");

const DEFAULT_CATEGORIES = [
  { name: "Elektronik", icon: "📱", sortOrder: 1 },
  { name: "Tekstil", icon: "👕", sortOrder: 2 },
  { name: "Gıda", icon: "🍎", sortOrder: 3 },
  { name: "Kozmetik", icon: "💄", sortOrder: 4 },
  { name: "Aksesuar", icon: "👜", sortOrder: 5 },
  { name: "Diğer", icon: "📦", sortOrder: 99 },
];

module.exports = {
  async up(db) {
    const orgIdHex = process.env.DEFAULT_ORG_ID || "000000000000000000000001";
    const orgId = new ObjectId(orgIdHex);
    const now = new Date();

    await db
      .collection("organizations")
      .updateOne(
        { _id: orgId },
        { $setOnInsert: { name: "Default", createdAt: now, updatedAt: now } },
        { upsert: true }
      );

    const docs = DEFAULT_CATEGORIES.map((c) => ({
      ...c,
      orgId,
      active: true,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }));

    for (const doc of docs) {
      await db
        .collection("categories")
        .updateOne({ orgId, name: doc.name }, { $setOnInsert: doc }, { upsert: true });
    }
  },

  async down(db) {
    const orgIdHex = process.env.DEFAULT_ORG_ID || "000000000000000000000001";
    const orgId = new ObjectId(orgIdHex);
    await db.collection("categories").deleteMany({
      orgId,
      name: { $in: DEFAULT_CATEGORIES.map((c) => c.name) },
    });
  },
};
