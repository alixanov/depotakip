"use strict";

// Tight coupling с порядком миграций: эта миграция стартует ДО RBAC
// (20260518000004), поэтому коллекций `roles`/`permissions` ещё нет, и
// `ensureAdmin` (apps/api/src/modules/auth/auth.service.ts:204) не сработает —
// он ищет системную роль "admin", которой пока не существует. Поэтому здесь
// raw bcrypt + legacy строковое поле `role: "admin"`, которое позже RBAC-
// миграция конвертирует в `roleId → roles._id`. Если переставите миграции
// местами или добавите новую между ними — обновите эту логику.

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
