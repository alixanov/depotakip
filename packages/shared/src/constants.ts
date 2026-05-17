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

export const ROLES = ["admin", "operator", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const DEFAULT_CATEGORIES = [
  "Elektronik",
  "Tekstil",
  "Gıda",
  "Kozmetik",
  "Aksesuar",
  "Diğer",
] as const;

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
