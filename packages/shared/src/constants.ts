export const STATUSES = ["bekliyor", "yolda", "teslim", "kayip", "borclu", "iptal"] as const;
export type Status = (typeof STATUSES)[number];

/** Semantic tone — UI maps this to Tailwind/CSS classes (dark-theme aware). */
export type StatusTone = "neutral" | "warning" | "success" | "danger" | "info" | "muted";

export const STATUS_TONE: Record<Status, StatusTone> = {
  bekliyor: "neutral",
  yolda: "warning",
  teslim: "success",
  kayip: "danger",
  borclu: "info",
  iptal: "muted",
};

export const LOT_STATUS_TONE: Record<LotStatus, StatusTone> = {
  in_stock: "success",
  partially_shipped: "warning",
  fully_shipped: "muted",
  withdrawn: "danger",
};

/**
 * Legacy table — UI should NOT use raw hex. Prefer `STATUS_TONE` + Tailwind
 * classes via `<StatusPill>` so dark theme works. Kept for backwards-compat.
 */
export interface StatusMeta {
  label: string;
  color: string;
  bg: string;
}

export const STATUS_LABELS: Record<Status, StatusMeta> = {
  bekliyor: { label: "Bekliyor", color: "#6B7280", bg: "#F3F4F6" },
  yolda: { label: "Yolda", color: "#F59E0B", bg: "#FEF3C7" },
  teslim: { label: "Teslim Edildi", color: "#10B981", bg: "#D1FAE5" },
  kayip: { label: "Kayıp", color: "#EF4444", bg: "#FEE2E2" },
  borclu: { label: "Borçlu", color: "#8B5CF6", bg: "#EDE9FE" },
  iptal: { label: "İptal", color: "#9CA3AF", bg: "#F3F4F6" },
};

export const CURRENCIES = ["USD", "UZS", "TRY"] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Built-in roles seeded by migration; cannot be deleted via the admin UI. */
export const SYSTEM_ROLE_NAMES = ["admin", "operator", "viewer"] as const;
export type SystemRoleName = (typeof SYSTEM_ROLE_NAMES)[number];

/**
 * UI-facing grouping for the permission matrix. Keep aligned with the
 * `group` field on system permissions below — the admin Roles page uses
 * this to render section headers.
 */
export const PERMISSION_GROUPS = [
  "warehouse",
  "shipments",
  "finance",
  "reference",
  "reports",
  "admin",
] as const;
export type PermissionGroup = (typeof PERMISSION_GROUPS)[number];

export interface SystemPermissionDef {
  key: string;
  label: string;
  description?: string;
  group: PermissionGroup;
}

/**
 * Source-of-truth catalogue of permissions actually checked in the codebase.
 * Migration 0005-rbac upserts these into the `permissions` collection with
 * isSystem=true. Adding a new requirePermission("foo:bar") call in code REQUIRES
 * appending it here so the seed picks it up — otherwise admins can't grant it.
 *
 * Permission keys use `module:action[:subaction]` (lower kebab). New custom
 * permissions added via the admin UI follow the same convention but are not
 * required to map to an actual endpoint — they can serve as feature flags.
 */
/**
 * Closed union of every permission key the codebase actually checks. Adds
 * compile-time typo detection to `requirePermission` / `useCan` / route
 * guards. Dynamic keys read from the DB (`permissions` collection) are
 * untyped `string[]`; cast to `PermissionKey` at the boundary if you need
 * to pass them to a typed helper.
 */
export type PermissionKey =
  | "lots:read"
  | "lots:write"
  | "lots:delete"
  | "lots:photos:delete"
  | "shipments:read"
  | "shipments:write"
  | "shipments:cancel"
  | "transactions:read"
  | "transactions:write"
  | "exchange_rates:read"
  | "exchange_rates:manage"
  | "senders:read"
  | "senders:write"
  | "senders:delete"
  | "carriers:read"
  | "carriers:write"
  | "carriers:delete"
  | "reports:read"
  | "users:manage"
  | "roles:manage"
  | "permissions:manage"
  | "notifications:read"
  | "notifications:manage"
  | "audit:read";

export const SYSTEM_PERMISSIONS: readonly (SystemPermissionDef & { key: PermissionKey })[] = [
  // — warehouse
  { key: "lots:read", group: "warehouse", label: "Партии — просмотр" },
  { key: "lots:write", group: "warehouse", label: "Партии — создание и редактирование" },
  { key: "lots:delete", group: "warehouse", label: "Партии — удаление" },
  { key: "lots:photos:delete", group: "warehouse", label: "Партии — удаление фото" },
  // — shipments
  { key: "shipments:read", group: "shipments", label: "Отгрузки — просмотр" },
  { key: "shipments:write", group: "shipments", label: "Отгрузки — создание и смена статуса" },
  { key: "shipments:cancel", group: "shipments", label: "Отгрузки — отмена (реверс qtyAvailable)" },
  // — finance
  { key: "transactions:read", group: "finance", label: "Операции — просмотр" },
  { key: "transactions:write", group: "finance", label: "Операции — регистрация платежа" },
  { key: "exchange_rates:read", group: "finance", label: "Курсы валют — просмотр" },
  { key: "exchange_rates:manage", group: "finance", label: "Курсы валют — управление" },
  // — reference
  { key: "senders:read", group: "reference", label: "Отправители — просмотр" },
  { key: "senders:write", group: "reference", label: "Отправители — создание и редактирование" },
  { key: "senders:delete", group: "reference", label: "Отправители — удаление" },
  { key: "carriers:read", group: "reference", label: "Перевозчики — просмотр" },
  { key: "carriers:write", group: "reference", label: "Перевозчики — создание и редактирование" },
  { key: "carriers:delete", group: "reference", label: "Перевозчики — удаление" },
  // — reports
  { key: "reports:read", group: "reports", label: "Отчёты и dashboard — просмотр" },
  // — admin
  { key: "users:manage", group: "admin", label: "Пользователи — управление" },
  { key: "roles:manage", group: "admin", label: "Роли — управление" },
  { key: "permissions:manage", group: "admin", label: "Разрешения — управление каталогом" },
  { key: "notifications:read", group: "admin", label: "Уведомления — просмотр шаблонов и логов" },
  { key: "notifications:manage", group: "admin", label: "Уведомления — управление шаблонами" },
  { key: "audit:read", group: "admin", label: "Audit log — просмотр" },
] as const;

/** Permission set for each seeded system role. */
export const SYSTEM_ROLE_PERMISSIONS: Record<SystemRoleName, readonly string[]> = {
  admin: SYSTEM_PERMISSIONS.map((p) => p.key),
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

export const NOTIFICATION_CHANNELS = ["sms", "telegram"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_LANGUAGES = ["tr", "ru", "uz"] as const;
export type NotificationLanguage = (typeof NOTIFICATION_LANGUAGES)[number];

export const NOTIFICATION_TEMPLATE_KEYS = [
  "shipment_bekliyor",
  "shipment_yolda",
  "shipment_teslim",
  "shipment_kayip",
  "shipment_iptal",
  "payment_received",
  "lot_received",
] as const;
export type NotificationTemplateKey = (typeof NOTIFICATION_TEMPLATE_KEYS)[number];

export const TRANSACTION_KINDS = [
  "carrier_charge",
  "carrier_payment",
  "sender_charge",
  "sender_payment",
  "adjustment",
] as const;
export type TransactionKind = (typeof TRANSACTION_KINDS)[number];

export const PAYMENT_METHODS = ["cash", "bank", "card", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const LOT_STATUSES = [
  "in_stock",
  "partially_shipped",
  "fully_shipped",
  "withdrawn",
] as const;
export type LotStatus = (typeof LOT_STATUSES)[number];
