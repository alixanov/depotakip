"use strict";

const { ObjectId } = require("mongodb");
const bcrypt = require("bcryptjs");

module.exports = {
  async up(db) {
    const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    const fullName = process.env.ADMIN_FULL_NAME || "Administrator";
    const orgIdHex = process.env.DEFAULT_ORG_ID || "000000000000000000000001";

    if (!email || !password) {
      console.log("[seed-admin] ADMIN_EMAIL/ADMIN_PASSWORD empty — skipping");
      return;
    }
    if (password.length < 10) {
      throw new Error("[seed-admin] ADMIN_PASSWORD must be at least 10 chars");
    }

    const existing = await db.collection("users").findOne({ email });
    if (existing) {
      console.log(`[seed-admin] user ${email} already exists — skipping`);
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const now = new Date();
    await db.collection("users").insertOne({
      orgId: new ObjectId(orgIdHex),
      email,
      passwordHash,
      fullName,
      role: "admin",
      active: true,
      mustChangePassword: false,
      lastLoginAt: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    console.log(`[seed-admin] admin ${email} created`);
  },

  async down(db) {
    const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    if (!email) return;
    await db.collection("users").deleteOne({ email, role: "admin" });
  },
};
