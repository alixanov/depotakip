"use strict";

// ─── RBAC ─────────────────────────────────────────────────────────────────
// Replaces the flat `users.role: "admin"|"operator"|"viewer"` enum with
// `users.roleId → roles._id`. Seeds the `permissions` and `roles` collections
// from the SYSTEM_PERMISSIONS / SYSTEM_ROLE_PERMISSIONS catalogues so the
// admin UI has something to display on first boot.
//
// Source of truth for permission keys lives in
// `packages/shared/src/constants.ts` — duplicated here verbatim because the
// migration runs in CJS context outside the TS build pipeline.

const { ObjectId } = require("mongodb");

const PERMISSIONS = [
  { key: "lots:read", group: "warehouse", label: "Партии — просмотр" },
  { key: "lots:write", group: "warehouse", label: "Партии — создание и редактирование" },
  { key: "lots:delete", group: "warehouse", label: "Партии — удаление" },
  { key: "lots:photos:delete", group: "warehouse", label: "Партии — удаление фото" },
  { key: "shipments:read", group: "shipments", label: "Отгрузки — просмотр" },
  { key: "shipments:write", group: "shipments", label: "Отгрузки — создание и смена статуса" },
  { key: "shipments:cancel", group: "shipments", label: "Отгрузки — отмена" },
  { key: "transactions:read", group: "finance", label: "Операции — просмотр" },
  { key: "transactions:write", group: "finance", label: "Операции — регистрация платежа" },
  { key: "exchange_rates:read", group: "finance", label: "Курсы валют — просмотр" },
  { key: "exchange_rates:manage", group: "finance", label: "Курсы валют — управление" },
  { key: "senders:read", group: "reference", label: "Отправители — просмотр" },
  { key: "senders:write", group: "reference", label: "Отправители — создание и редактирование" },
  { key: "senders:delete", group: "reference", label: "Отправители — удаление" },
  { key: "carriers:read", group: "reference", label: "Перевозчики — просмотр" },
  { key: "carriers:write", group: "reference", label: "Перевозчики — создание и редактирование" },
  { key: "carriers:delete", group: "reference", label: "Перевозчики — удаление" },
  { key: "reports:read", group: "reports", label: "Отчёты и dashboard — просмотр" },
  { key: "users:manage", group: "admin", label: "Пользователи — управление" },
  { key: "roles:manage", group: "admin", label: "Роли — управление" },
  { key: "permissions:manage", group: "admin", label: "Разрешения — управление каталогом" },
  { key: "notifications:read", group: "admin", label: "Уведомления — просмотр" },
  { key: "notifications:manage", group: "admin", label: "Уведомления — управление" },
  { key: "audit:read", group: "admin", label: "Audit log — просмотр" },
];

const ROLE_PERMISSIONS = {
  admin: PERMISSIONS.map((p) => p.key),
  operator: [
    "lots:read",
    "lots:write",
    "shipments:read",
    "shipments:write",
    "shipments:cancel",
    "transactions:read",
    "transactions:write",
    "exchange_rates:read",
    "senders:read",
    "senders:write",
    "carriers:read",
    "carriers:write",
    "reports:read",
  ],
  viewer: [
    "lots:read",
    "shipments:read",
    "transactions:read",
    "exchange_rates:read",
    "senders:read",
    "carriers:read",
    "reports:read",
  ],
};

module.exports = {
  async up(db) {
    const orgIdHex = process.env.DEFAULT_ORG_ID || "000000000000000000000001";
    const orgId = new ObjectId(orgIdHex);
    const now = new Date();

    // 1. Indexes.
    await db
      .collection("permissions")
      .createIndex({ key: 1 }, { unique: true, name: "permissions_key_unique" });
    await db.collection("permissions").createIndex({ group: 1, key: 1 });
    await db
      .collection("roles")
      .createIndex({ orgId: 1, name: 1 }, { unique: true, name: "roles_orgId_name_unique" });

    // 2. Upsert system permissions.
    const permOps = PERMISSIONS.map((p) => ({
      updateOne: {
        filter: { key: p.key },
        update: {
          $set: {
            label: p.label,
            group: p.group,
            description: "",
            isSystem: true,
            updatedAt: now,
          },
          $setOnInsert: { key: p.key, createdAt: now },
        },
        upsert: true,
      },
    }));
    await db.collection("permissions").bulkWrite(permOps);
    console.log(`[rbac] upserted ${PERMISSIONS.length} system permissions`);

    // 3. Upsert system roles for the default org.
    for (const [name, permissions] of Object.entries(ROLE_PERMISSIONS)) {
      await db.collection("roles").updateOne(
        { orgId, name },
        {
          $set: {
            description: `System role — ${name}`,
            permissions,
            isSystem: true,
            updatedAt: now,
          },
          $setOnInsert: { orgId, name, createdAt: now },
        },
        { upsert: true }
      );
    }
    console.log("[rbac] seeded system roles (admin/operator/viewer)");

    // 4. Migrate users.role string → users.roleId ObjectId. Any legacy user
    //    without a recognised role string falls back to viewer (read-only) to
    //    fail safely.
    const roles = await db.collection("roles").find({ orgId, isSystem: true }).toArray();
    const roleByName = new Map(roles.map((r) => [r.name, r._id]));
    const viewerId = roleByName.get("viewer");

    const users = await db.collection("users").find({}).toArray();
    let migrated = 0;
    for (const u of users) {
      if (u.roleId) continue; // already migrated
      const targetRoleId = roleByName.get(u.role) ?? viewerId;
      if (!targetRoleId) {
        console.warn(`[rbac] no role to assign user ${u.email} — skipping`);
        continue;
      }
      await db
        .collection("users")
        .updateOne(
          { _id: u._id },
          { $set: { roleId: targetRoleId, updatedAt: now }, $unset: { role: "" } }
        );
      migrated += 1;
    }
    console.log(`[rbac] migrated ${migrated} users to roleId`);

    // 5. Re-index users for the new field shape.
    await db.collection("users").createIndex({ orgId: 1, roleId: 1 });
    try {
      await db.collection("users").dropIndex("orgId_1_role_1");
    } catch {
      // index might not exist on fresh installs
    }
  },

  async down(db) {
    // Best-effort reversal: copy role name back into the user document, then
    // drop the new collections and indexes. Custom permissions/roles are lost.
    const roles = await db.collection("roles").find({}).toArray();
    const nameById = new Map(roles.map((r) => [r._id.toString(), r.name]));
    const users = await db
      .collection("users")
      .find({ roleId: { $exists: true } })
      .toArray();
    for (const u of users) {
      const name = nameById.get(u.roleId.toString()) ?? "viewer";
      await db
        .collection("users")
        .updateOne({ _id: u._id }, { $set: { role: name }, $unset: { roleId: "" } });
    }
    await db
      .collection("roles")
      .drop()
      .catch(() => {});
    await db
      .collection("permissions")
      .drop()
      .catch(() => {});
    await db.collection("users").createIndex({ orgId: 1, role: 1 });
    try {
      await db.collection("users").dropIndex("orgId_1_roleId_1");
    } catch {}
  },
};
