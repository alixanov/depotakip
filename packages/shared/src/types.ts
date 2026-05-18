import type {
  Currency,
  LotStatus,
  NotificationChannel,
  NotificationLanguage,
  NotificationTemplateKey,
  PaymentMethod,
  PermissionGroup,
  Status,
  TransactionKind,
} from "./constants.js";

/** Denormalised money value used everywhere — amount in minor units (cents/tiyin). */
export interface Money {
  amount: number;
  currency: Currency;
}

export interface PhotoRef {
  /** ObjectId; used in /lots/:id/photos/:photoId endpoints. */
  id: string;
  /** Always "image/jpeg" today (sharp converts everything) but kept open. */
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  uploadedAt: string;
}

export interface SignedPhotoUrlResponse {
  url: string;
  /** ISO timestamp when the presigned URL stops working. */
  expiresAt: string;
}

export interface UserRoleRef {
  id: string;
  name: string;
  isSystem: boolean;
  permissions: string[];
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  /** Denormalised role reference + the flat permission keys for fast UI checks. */
  role: UserRoleRef;
  active: boolean;
  lastLoginAt?: string | null;
}

export interface AuthResponse {
  user: User;
  /** Access JWT (also returned in body for non-cookie clients). */
  accessToken: string;
}

export interface Permission {
  id: string;
  key: string;
  label: string;
  description: string;
  group: PermissionGroup | null;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  /** Helpful for the admin Roles page — disables delete when > 0. */
  userCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Sender {
  id: string;
  fullName: string;
  phone: string;
  telegramChatId: number | null;
  /** Public Telegram handle (no leading `@`). Display + click-to-open only;
   *  the Bot API cannot DM private users by username, so notifications still
   *  require {@link telegramChatId}. */
  telegramUsername: string | null;
  address: string;
  notes: string;
  isSelf: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Carrier {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  telegramChatId: number | null;
  /** See {@link Sender.telegramUsername} — same display-only semantics. */
  telegramUsername: string | null;
  deliveryAddressTr: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface InboundLot {
  id: string;
  senderId: string;
  label: string;
  qtyIn: number;
  qtyAvailable: number;
  unitPrice: Money | null;
  receivedAt: string;
  status: LotStatus;
  notes: string;
  photos: PhotoRef[];
  /**
   * One-hour presigned URL for `photos[0]` — surfaced by `/lots` and
   * `/lots/:id` so list-style views (shipment lot-picker) can show a
   * thumbnail without an extra round-trip. Undefined when the lot has
   * no photos.
   */
  firstPhotoUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Recipient {
  name: string;
  phone: string;
  addressTr: string;
}

export interface ShipmentItem {
  id: string;
  lotId: string;
  qty: number;
  senderCharge: Money | null;
}

export interface ShipmentStatusEvent {
  fromStatus: Status | null;
  toStatus: Status;
  changedBy: string;
  changedAt: string;
  comment: string;
  proofPhoto: PhotoRef | null;
}

export interface Shipment {
  id: string;
  shortCode: string;
  carrierId: string;
  recipient: Recipient | null;
  shipmentDate: string;
  carrierFee: Money;
  status: Status;
  items: ShipmentItem[];
  statusHistory: ShipmentStatusEvent[];
  publicTrackingToken: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  kind: TransactionKind;
  counterparty: { type: "carrier" | "sender"; id: string };
  shipmentId: string | null;
  amount: number;
  currency: Currency;
  direction: "debit" | "credit";
  txDate: string;
  exchangeRateToUsd: number;
  amountUsdSnapshot: number;
  method: PaymentMethod;
  notes: string;
  reversesTransactionId: string | null;
  createdAt: string;
}

export interface ExchangeRate {
  id: string;
  currency: Currency;
  rateToUsd: number;
  rateDate: string;
  source: "cbu" | "manual";
}

export interface Balance {
  counterpartyId: string;
  balanceUsd: number;
  debitUsd: number;
  creditUsd: number;
}

export interface NotificationTemplate {
  id: string;
  key: NotificationTemplateKey;
  channel: NotificationChannel;
  language: NotificationLanguage;
  body: string;
  active: boolean;
}

export interface NotificationLogEntry {
  id: string;
  channel: NotificationChannel;
  recipientType: "sender" | "carrier" | "recipient";
  recipientRef: { id: string | null; phone: string | null; chatId: number | null };
  templateKey: string;
  renderedText: string;
  status: "queued" | "sent" | "failed";
  attempts: number;
  sentAt: string | null;
  errorMessage: string | null;
}

export interface AuditEntry {
  id: string;
  userId: string;
  action: "create" | "update" | "delete" | "login" | "export" | "status_change";
  entityType: string;
  entityId: string;
  diff: { before: unknown; after: unknown };
  ip: string;
  userAgent: string;
  at: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; hasMore: boolean };
}

export interface ApiErrorBody {
  error: string;
  code?: string;
  details?: unknown;
  requestId?: string;
  fields?: Record<string, string>;
}
