# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Source of truth

Domain identifiers stay Turkish (`sender/gönderici`, `carrier/kargocu`,
`recipient/alıcı`, `shipment/gönderi`, `lot`). Do not translate UI strings or
field names. UI surfaces ship in three locales (`tr`, `ru`, `uz`) — see
`apps/web/src/lib/i18n.locales/`.

## Monorepo layout

npm workspaces, four packages:

```
apps/
├── web/             @sadiyakargo/web              Vite 6 + React 19.2 + React Compiler + TS strict
└── api/             @sadiyakargo/api              Express 5 + Mongoose 8 + JWT + pino + zod (TS)
packages/
├── shared/          @sadiyakargo/shared           zod schemas + TS types + domain constants
└── pdf-templates/   @sadiyakargo/pdf-templates    @react-pdf/renderer documents + NotoSans + QR
```

Root is `"type": "module"`. There is **one** `package-lock.json` in the repo
root — never create per-workspace lockfiles. Workspace deps (`@sadiyakargo/*`)
are consumed as TS source (no build step) — `main: "./src/index.ts"`.

## Commands (run from repo root)

| Command                                    | What it does                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------ |
| `npm install`                              | Installs deps for all workspaces into a hoisted `node_modules/`.         |
| `npm run dev`                              | Runs **both** apps in parallel (web :3000, api :4000) via `npm-run-all`. |
| `npm run dev:web`                          | Only the Vite dev server.                                                |
| `npm run dev:api`                          | Only the API with `tsx --watch`.                                         |
| `npm run build`                            | `build:api` (tsup → CJS, copies NotoSans TTF) then `build:web` (Vite).   |
| `npm run start:api`                        | `node --env-file=.env dist/server.cjs`.                                  |
| `npm test`                                 | Vitest + Supertest integration suite for the API (in-memory MongoDB).    |
| `npm run lint`                             | ESLint 9 flat config + `eslint-plugin-react-compiler`.                   |
| `npm run typecheck`                        | `tsc --noEmit` for both `api` and `web`.                                 |
| `npm run format` / `format:check`          | Prettier — write / read-only check.                                      |
| `npm run migrate:up` / `:down` / `:status` | `migrate-mongo` against `MONGODB_URI`.                                   |
| `npm run seed:demo` / `clean:demo`         | Populate / purge demo data tagged `[DEMO]` in `notes`.                   |

Additional one-off scripts in `scripts/`: `clean-prod.mjs` (full business-data
wipe; `--dry-run` by default, requires `--confirm yes-delete-prod` to actually
delete), `clean-prod-photos.mjs`, `clean-partial.mjs`.

`.husky/pre-commit` runs `lint-staged` over staged files only.

## Shared package (`packages/shared`)

The **single source of truth** for zod schemas, domain enums, and TS types.
Consumed as TypeScript source (no build step): `"main": "./src/index.ts"` with
bundler resolution (Vite for web, tsx/tsup for api).

- `src/constants.ts` — `STATUSES` (incl. `bekliyor`), `STATUS_TONE`,
  `STATUS_LABELS` (legacy hex pairs — prefer `STATUS_TONE` + `<StatusPill>`),
  `LOT_STATUSES`, `LOT_STATUS_TONE`, `CURRENCIES`, `PAYMENT_METHODS`,
  `TRANSACTION_KINDS`, `NOTIFICATION_*`, `PERMISSION_GROUPS`,
  `SYSTEM_PERMISSIONS`, `SYSTEM_ROLE_NAMES`, `SYSTEM_ROLE_PERMISSIONS`, and
  the closed-union `PermissionKey` type.
- `src/schemas/` — one file per domain (auth, user, access, sender, carrier,
  lot, shipment, transaction, exchangeRate, notification, common). Each file
  exports both the zod schema **and** the `z.infer<...>` type.
- `src/types.ts` — denormalised domain types (`User`, `UserRoleRef`, `Role`,
  `Permission`, `Sender`, `Carrier`, `InboundLot`, `PhotoRef`, `Shipment`,
  `Transaction`, `Money`, `NotificationLogEntry`, `AuditEntry`, …) used as
  API response types.

**Money everywhere** is `{ amount: number, currency: Currency }` where
`amount` is in **minor units** (cents/tiyin). Never use floats for monetary
values.

**Permission catalogue is closed:** every `requirePermission("foo:bar")` call
in API code must have a matching entry in `SYSTEM_PERMISSIONS` (it's also a
member of the `PermissionKey` union). Migration `0518-004-rbac.cjs` upserts
this catalogue into the `permissions` collection with `isSystem: true`.

## Backend (`apps/api`)

Express 5 + Mongoose 8 + zod + pino + JWT + Socket.IO + BullMQ. TypeScript
strict.

### Layout

```
apps/api/src/
├── server.ts                  – entry: env validation → db connect → http+socket.io → listen + graceful shutdown
├── app.ts                     – express app (pino-http, helmet, cors, sanitize, originCheck,
│                                audit, global rate-limit, routes, error handler)
├── config/
│   ├── env.ts                 – zod-validated process.env; crashes early on bad config
│   └── db.ts                  – mongoose connect/disconnect (parameterised for tests)
├── lib/
│   ├── errors.ts              – AppError + factories: badRequest/unauthorized/notFound/conflict/...
│   ├── asyncHandler.ts        – tiny wrapper kept for clarity (Express 5 forwards rejections natively)
│   ├── jwt.ts                 – signAccessToken/signRefreshToken + verifiers (AccessPayload carries permissions[])
│   ├── password.ts            – bcrypt cost 12
│   ├── cookies.ts             – refresh cookie name + options (SameSite=Lax, see below)
│   ├── duration.ts            – parse "15m"/"30d"/"2h" into ms
│   ├── logger.ts              – pino + pino-pretty in dev; redacts Authorization/Cookie/password*
│   ├── mailer.ts              – nodemailer SMTP; falls back to logging when SMTP_HOST empty
│   ├── realtime.ts            – Socket.IO server handle + emitOrgEvent()
│   ├── repository.ts          – tenantFilter() + paginate() + softDeleteOne() helpers
│   ├── storage.ts             – S3 client (putObject/getPresignedGetUrl/deleteObject) + buildLotPhotoKey
│   └── pdfLang.ts             – resolve ?lang=tr|ru|uz from query to PdfLocale
├── middleware/
│   ├── auth.ts                – requireAuth (Bearer JWT) + requirePermission/requireAnyPermission (PermissionKey)
│   ├── validate.ts            – zod request validator: { body?, params?, query? }
│   ├── sanitize.ts            – strips `$...` / `a.b` keys from req.body (Express 5–safe replacement for express-mongo-sanitize)
│   ├── originCheck.ts         – Origin/Referer allow-list check on unsafe methods (CSRF layer 2)
│   ├── audit.ts               – persists AuditLog row for every successful 2xx mutation (with phone masking)
│   ├── idempotency.ts         – Idempotency-Key replay on POST /shipments + /transactions
│   ├── upload.ts              – multer memoryStorage + image-only filter (magic-byte check happens in service)
│   ├── error.ts               – central handler → { error, code, details?, fields? }
│   └── notFound.ts            – 404 fallback
├── modules/
│   ├── health/                – GET /api/v1/health
│   ├── auth/                  – login/refresh/logout/me/forgot/reset/change-password + RefreshToken/PasswordResetToken models
│   ├── users/                 – CRUD + temp-password issuance + self-edit guards
│   ├── access/                – roles + permissions (dynamic RBAC, system role/permission lock)
│   ├── senders/, carriers/    – reference data CRUD + soft-delete
│   ├── exchangeRates/         – manual rate entry + convertToUsd() helper with per-day cache
│   ├── lots/                  – inbound lot CRUD + photo upload pipeline (sharp + S3) + receipt PDF
│   ├── shipments/             – create (atomic qtyAvailable decrement + auto-tx) + status changes + waybill PDF + public tracking
│   ├── transactions/          – payments + balances + payment-receipt PDF
│   ├── notifications/         – templates + log + Telegram adapter + BullMQ queue (fallback in-process when REDIS_URL empty)
│   ├── reports/               – dashboard + carriers/senders/finance reports + CSV/XLSX export
│   ├── search/                – global multi-collection search (powers ⌘K palette)
│   └── audit/                 – read-only audit-log endpoint (requires audit:read)
└── migrations are CJS files in apps/api/migrations/*.cjs
```

### Conventions (binding)

- **Per-org scoping is non-negotiable.** Every query against tenant-scoped
  collections MUST include `orgId: req.orgId`. Resource fetches additionally
  check `userId` where the resource is per-user.
- **RBAC is dynamic.** `users.roleId → roles._id`; each `Role` carries a flat
  `permissions: string[]`. The JWT access token snapshots the user's
  permissions at issue time (`AccessPayload.permissions`). Permission edits
  propagate on the next `/auth/refresh` (≤ access-token TTL, default 15min).
  System roles (`admin`/`operator`/`viewer`) cannot be renamed, have their
  permissions edited, or deleted — `roles.service` enforces this.
- **Validation happens in middleware** via zod schemas from
  `@sadiyakargo/shared`. Controllers receive already-parsed `req.body` /
  `req.params` / `req.query` and never re-check shape.
- **Errors throw `AppError` or its factory wrappers** from `lib/errors.ts`.
  The central middleware maps mongoose CastError → 400, ValidationError → 422,
  duplicate-key → 409, multer LIMIT_FILE_SIZE → 413, `UNSUPPORTED_MEDIA` → 415.
  Don't write your own try/catch → res.status branches.
- **Repositories own mongoose.** Services depend on repositories, not models,
  so services are easy to fake in unit tests. Don't import a model from a
  controller or another module.
- **All tenant-scoped mutating routes are auth-protected**
  (`router.use(requireAuth)` at the top of each feature router; specific
  mutations gated by `requirePermission(...)`). Health, auth, and
  `/public/track/:token` are the only unauthenticated routes.
- **Idempotency:** `POST /shipments` and `POST /transactions` honour the
  `Idempotency-Key` header — middleware checks the `idempotencyKeys` collection
  before executing (24h TTL).
- **Soft delete:** all tenant collections carry `deletedAt: Date | null`.
  Use the `notDeleted()` / `tenantFilter()` helpers; never hard-delete in
  service code.
- **Money in minor units** as `{ amount, currency }`. Never floats. Conversion
  uses the snapshot of the exchange rate on the transaction date
  (`Transaction.exchangeRateToUsd` + `amountUsdSnapshot`).
- **MongoDB transactions** (`session.withTransaction`) for shipment
  create/cancel and any multi-document write that touches `qtyAvailable`.
  Requires a replica set (docker-compose ships single-node rs0 for dev; Atlas
  in prod).
- **Audit log** is written by global middleware for every successful
  2xx mutation (POST/PATCH/PUT/DELETE). PII (phones) masked as `***1234`,
  passwords/hashes dropped entirely in `auditLog.diff`. TTL 2 years.
- **Realtime:** Socket.IO authenticates the handshake with the same JWT used
  for REST, joins each socket to `org:{orgId}` (and `org:{orgId}:admin` when
  `audit:read` is granted). `emitOrgEvent()` broadcasts `shipment:created`,
  `shipment:status_changed`, etc.

### Security stack

- `helmet` (default CSP/HSTS/X-Frame-Options)
- `cors` with allow-listed origins (`CORS_ORIGIN`, comma-separated)
- `sanitize` middleware strips MongoDB operator keys from `req.body` (Express
  5–compatible replacement for `express-mongo-sanitize`/`hpp` — both of which
  mutate the now-immutable `req.query`)
- `express-rate-limit`: global (default 300/min) + tight auth (10/15min) +
  tight public-track (20/min)
- JWT: short access (15m) + httpOnly Secure SameSite=**Lax** refresh cookie
  (30d) with **rotation + replay detection** (an attempt to reuse a revoked
  refresh token invalidates every active token for that user)
- CSRF defence: SameSite=Lax on the refresh cookie + `originCheck` middleware
  validates Origin/Referer against the CORS allow-list on every unsafe method.
  Lax (not Strict) is required because prod web + api live on different
  Railway subdomains, which the browser treats as separate sites per the
  Public Suffix List — Strict would drop the refresh cookie on every
  navigation.
- bcrypt cost 12; password ≥ 10 chars enforced in zod
- File uploads validated via `file-type` magic bytes (not Content-Type) plus
  sharp normalisation (auto-rotate EXIF → resize 1600 → re-encode JPEG q=80)
  before reaching S3
- 2FA TOTP via `speakeasy` — Etap 9 (planned)

### Environment (`apps/api/.env`)

Validated by zod at startup. `apps/api/.env.example` carries the full,
annotated key list with per-key local/prod guidance — keep it in sync with
`apps/api/src/config/env.ts`.

Required:

- `MONGODB_URI` — must point at a **replica set** (Atlas or
  `?replicaSet=rs0` against docker-compose)
- `JWT_ACCESS_SECRET` — ≥ 32 chars
- `JWT_REFRESH_SECRET` — ≥ 32 chars, MUST differ from access

Optional, with sensible defaults baked into `env.ts`:

- App / HTTP: `NODE_ENV`, `PORT`, `API_PREFIX`
- JWT lifetimes: `JWT_ACCESS_TTL` (`15m`), `JWT_REFRESH_TTL` (`30d`)
- CORS / cookies: `CORS_ORIGIN`, `COOKIE_DOMAIN`, `COOKIE_SECURE`
- Rate limits: all `RATE_LIMIT_AUTH_*`, `RATE_LIMIT_GLOBAL_*`,
  `RATE_LIMIT_PUBLIC_TRACK_*`
- Logging: `LOG_LEVEL`
- SMTP (empty = log to stdout): `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
  `SMTP_PASS`, `SMTP_FROM`
- `WEB_BASE_URL` — used in password-reset and tracking links
- `REDIS_URL` — BullMQ; empty = in-process synchronous fallback (dev/tests)
- Telegram: `TELEGRAM_BOT_TOKEN` (empty = log payloads), `TELEGRAM_BOT_USERNAME`
- Admin seed: `ADMIN_EMAIL`, `ADMIN_PASSWORD` (≥10), `ADMIN_FULL_NAME` —
  consumed only by the seed migration; safe to remove after first run
- Multi-tenancy: `DEFAULT_ORG_ID` (24-hex ObjectId, default
  `000000000000000000000001`)
- S3: `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`,
  `S3_SECRET_KEY`, `S3_FORCE_PATH_STYLE` (`true` for MinIO/R2/Wasabi/B2,
  `false` for AWS S3)
- Lot photos: `LOT_PHOTO_MAX_BYTES` (10 MB), `LOT_PHOTO_MAX_COUNT` (10),
  `LOT_PHOTO_PRESIGNED_TTL_SECONDS` (3600)
- Branding: `ORG_NAME` (printed on every PDF and used as `author` metadata)

## Frontend (`apps/web`)

Vite 6 + React 19.2 + React Compiler + TypeScript strict + Tailwind 4 +
shadcn/ui + TanStack Router (file-based) + TanStack Query + Zustand +
react-hook-form + lucide-react + i18next (`tr`/`ru`/`uz`) + Socket.IO client

- Recharts + sonner + cmdk + canvas-confetti + vite-plugin-pwa.

### Layout

```
apps/web/src/
├── main.tsx                   – ReactDOM root + providers (QueryClient, RouterProvider, TooltipProvider, Toaster)
├── routes/                    – TanStack Router file-based (autoCodeSplit on): __root + per-route .tsx
│                                generates routeTree.gen.ts (ignored by ESLint/Prettier)
├── components/ui/             – shadcn primitives (button, input, dialog, sheet, dropdown-menu, …)
├── components/                – non-ui shared components:
│                                BrandMark, HeaderControls (LanguageSwitcher/ThemeToggle/OfflineBanner),
│                                MobileBottomNav, CommandPalette (⌘K), ShipmentDetailSheet,
│                                ShipmentStatusChanger, PhotoPicker + PhotoGalleryLightbox + PhotoThumb,
│                                CameraCaptureDialog (getUserMedia → JPEG), LotShipmentsSheet,
│                                SenderFormDialog, CarrierFormDialog, ScrollToTop, ErrorPage
├── stores/                    – Zustand stores: auth (persist user only — accessToken stays in memory),
│                                ui (theme + lang), realtime (per-shipment flash highlight)
├── lib/
│   ├── env.ts                 – API_BASE / SOCKET_URL from import.meta.env
│   ├── utils.ts               – cn() (clsx + tailwind-merge)
│   ├── api/                   – per-domain client modules; all go through lib/api/client.ts
│   ├── api/client.ts          – fetch wrapper + ApiError + Idempotency-Key + auto /auth/refresh on 401
│   ├── format.ts              – useFormatters() hook + formatMoney/formatUsdCents/formatDate/...
│   ├── i18n.ts + i18n.locales/{tr,ru,uz}.json   – i18next setup (keep all three locales synced)
│   ├── guards.ts              – TanStack Router beforeLoad guards: requireAuth, requirePermission
│   ├── useDebouncedValue.ts   – debounce hook for search inputs
│   ├── useApiFormErrors.ts    – maps ApiError.fields / .details into react-hook-form setError
│   ├── useUndoableDelete.ts   – optimistic delete with 5s undo toast
│   ├── useLogout.ts           – revoke + clear + redirect to /login
│   ├── confetti.ts            – celebrate() on shipment teslim (respects prefers-reduced-motion)
│   └── realtime.ts            – Socket.IO client hook → invalidate queries on org events
└── styles.css                 – @import "tailwindcss" + HSL design tokens (light + .dark) + utility classes
```

PWA is enabled via `vite-plugin-pwa` (autoUpdate, NetworkFirst for `/api/v1/*`
with 4s timeout + 5min entry TTL, navigate fallback to `/index.html`).

### Conventions

- **React 19 features actively used:** `use()` for promise/context unwrapping;
  Actions for forms (`<form action={...}>` + `useActionState`); `useOptimistic`
  for status changes and payments; ref as a regular prop (no `forwardRef`);
  Document Metadata for page titles.
- **React Compiler** is on (Vite babel plugin) — **do not add manual
  `useMemo`/`useCallback`** except where Compiler reports a bailout in dev.
  To opt a file out, add `'use no memo'`.
- **Server state lives in TanStack Query**. Each feature owns its hooks
  (`useSendersQuery`, `useCreateSender`, etc.). `useMutation.onSuccess`
  updates the cache with `qc.setQueryData` (no full refetch) and invalidates
  sibling queries cross-feature when needed.
- **Client/UI state lives in Zustand or `useState`.** Don't put form drafts
  into Query cache.
- **Forms use react-hook-form + zodResolver** with schemas from
  `@sadiyakargo/shared`. `useApiFormErrors(form)` bridges 422s from the API
  into `setError` on the matching field.
- **All requests go through `lib/api/client.ts`.** It auto-attaches the access
  token from Zustand, sets `Idempotency-Key` when supplied, unwraps
  `{ error, code, fields }` into `ApiError`, and silently calls
  `/auth/refresh` on 401 then retries once before logging out.
- **Permission checks:** `useCan(perm)` / `useCanAny(...perms)` /
  `userCan(user, perm)` from `stores/auth`. Typed against `PermissionKey` so
  a typo like `"lots:wrtie"` fails at compile time. Route-level gates use
  `requireAuth` / `requirePermission` / `requireAnyPermission` from
  `lib/guards`. **The backend is the real security boundary** — the JWT
  permission snapshot can lag up to 15min behind admin changes.
- **Theme values come from `styles.css` CSS variables** (shadcn pattern:
  `bg-primary`, `text-foreground`, `bg-primary-soft`, etc.). No literal hex
  colours in new components.
- **Status colours come from `STATUS_TONE` / `LOT_STATUS_TONE`** in
  `@sadiyakargo/shared` via `<StatusPill>` / `<LotStatusPill>`; do not
  duplicate. The legacy `STATUS_LABELS` hex map is kept for backwards-compat
  only.
- **Path imports use `@/` for `src/`**. Workspace deps via `@sadiyakargo/*`
  resolve through the symlink with bundler resolution.
- **Icons:** `lucide-react` only. No emoji in production code.
- **PDF downloads:** every PDF link goes through `download*Pdf()` helpers that
  attach the bearer token via `fetch` + blob (so the access JWT isn't smuggled
  into a `<a href>`), pass `?lang=<currentUiLang>`, and surface failures
  through `sonner`.

### UI structure

Nine top-level tabs: Ana Sayfa / Depo / Göndericiler / Kargocular / Çıkış /
Takip / Finans / Raporlar / Ayarlar (admin pages live under `/admin/*`).
Desktop nav is inline in the sticky header; mobile shows a 5-tab bottom nav
(home / depo / cikis-or-takip / finans / menü) — the third slot swaps based
on the user's `shipments:write` permission. The overflow drawer ("Menü")
exposes everything the user has permission for. Touch targets are ≥ 44 × 44
px (WCAG 2.2 SC 2.5.8). Mobile-first; tablet/desktop becomes a centred card
via Tailwind responsive utilities.

## Tooling

- **ESLint 9 flat config** (`eslint.config.js`) with separate scopes for
  backend TS (`apps/api` + `packages/shared`), CJS migrations
  (`apps/api/migrations/`), one-off scripts (`scripts/`), and frontend
  TS+React+`react-compiler` (`apps/web`). Prettier compatibility via
  `eslint-config-prettier`.
- **Prettier** (`.prettierrc.json`) — `printWidth 100`, double quotes,
  trailing comma ES5, LF endings.
- **Husky + lint-staged** — pre-commit runs ESLint --fix + Prettier on staged
  files only.
- **Strict TS** everywhere — no `any`, no `as any` workarounds. If a type
  fights you, fix the underlying shape rather than escape-hatching.
- **tsup** bundles the API to `dist/server.cjs` (target node22, shims
  `import.meta.url` for the PDF font loader, copies the NotoSans TTF into
  `dist/fonts/` via `onSuccess`).

## Communication

Communicate with the user in Russian per session preference; keep code
identifiers Turkish. README.md §Roadmap tracks high-level project stages.
When in doubt, ask the user.
