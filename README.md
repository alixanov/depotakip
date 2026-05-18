# Sadiya Kargo — Monorepo

Warehouse & shipment management system for Uzbekistan → Turkey logistics.
React 19 + Express 5 + MongoDB + TypeScript end-to-end, organised as an
npm-workspaces monorepo. See [`CLAUDE.md`](./CLAUDE.md) for working
conventions; the §Roadmap below tracks high-level stages.

## Workspaces

```
sadiyakargo/
├── apps/
│   ├── web/             @sadiyakargo/web             Vite 6 + React 19 + React Compiler + Tailwind 4
│   │                                                 + shadcn/ui + TanStack Router + TanStack Query
│   │                                                 + Zustand + react-hook-form + i18next + PWA
│   └── api/             @sadiyakargo/api             Express 5 + Mongoose 8 + JWT (refresh-cookies)
│                                                    + pino + helmet + zod + Socket.IO + BullMQ
├── packages/
│   ├── shared/          @sadiyakargo/shared          Zod schemas + TS types + domain constants
│   │                                                 (SYSTEM_PERMISSIONS catalogue)
│   └── pdf-templates/   @sadiyakargo/pdf-templates   @react-pdf/renderer documents
│                                                    (receipt / waybill / payment) + NotoSans + QR
├── docker-compose.yml                                mongo (rs0) + redis + minio + minio-init
└── .github/workflows/ci.yml                          lint + format + typecheck + build + test
```

## Prerequisites

- **Node.js ≥ 22** (developed/tested on 24.x; CI runs 22 LTS)
- **npm ≥ 10**
- **Docker** (for local mongo replica set + redis + minio) — or external
  Atlas + Upstash + Cloudflare R2

## Setup

```bash
git clone <repo> && cd sadiyakargo
npm install                                # installs deps for all workspaces

cp apps/api/.env.example apps/api/.env
# Generate two strong secrets (≥ 32 chars each):
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
# paste into JWT_ACCESS_SECRET and JWT_REFRESH_SECRET in apps/api/.env
# Optionally set ADMIN_EMAIL + ADMIN_PASSWORD to seed the first admin user

docker compose up -d                       # mongo (rs0), redis, minio + bucket bootstrap
npm run migrate:up                         # creates indexes + seeds permissions/roles
                                           # + notification templates + first admin (if env set)
```

Husky pre-commit hook is wired by `npm install` (via the `prepare` script).

## Running in development

```bash
npm run dev                                # web :3000 + api :4000 in parallel
npm run dev:web                            # only the Vite dev server
npm run dev:api                            # only the API with tsx --watch
```

The web app proxies `/api/*` to `http://localhost:4000` in dev (see
`apps/web/vite.config.ts`). The API mounts everything under `/api/v1`
(configurable via `API_PREFIX`).

## Production

```bash
npm run build                              # tsup → dist/server.cjs (+ NotoSans TTF) + vite build → build/
npm run start:api                          # node --env-file=.env dist/server.cjs
```

Serve `apps/web/build/` with any static host and reverse-proxy `/api/*` to
the API process. Set `VITE_API_URL` at build time if the API lives on a
different origin.

## Quality

| Script                            | What it does                                                                  |
| --------------------------------- | ----------------------------------------------------------------------------- |
| `npm run lint`                    | ESLint 9 flat config with `eslint-plugin-react-compiler` over all workspaces. |
| `npm run format` / `format:check` | Prettier — write changes / read-only check (CI mode).                         |
| `npm run typecheck`               | `tsc --noEmit` for both `api` and `web`.                                      |
| `npm test`                        | Vitest + Supertest integration tests for the API (in-memory rs0 MongoDB).     |

`pre-commit` (Husky) runs `lint-staged`: ESLint + Prettier on staged files
only.

## Demo data

```bash
npm run seed:demo                          # populates senders/carriers/lots/shipments/txs/photos
                                           # tagged "[DEMO]" in `notes`
npm run clean:demo                         # removes everything tagged "[DEMO]"
```

Additional one-off scripts in `scripts/`:

- `clean-prod.mjs` — full business-data wipe (preserves users/roles/permissions/orgs).
  `--dry-run` by default; pass `--confirm yes-delete-prod` to actually delete.
- `clean-prod-photos.mjs` — removes orphaned S3 objects no longer referenced
  by any lot.
- `clean-partial.mjs` — cleans `[DEMO]`/`[DIAG]` artefacts left by a partial
  seed.

## Migrations

```bash
npm run migrate:up                         # apply pending migrations
npm run migrate:down                       # roll back the last migration
npm run migrate:status                     # show migration history
npm run migrate:create -- name             # scaffold a new migration file
```

History lives in the `_migrations` collection. Migration files are CJS
(`apps/api/migrations/*.cjs`). The current chain seeds indexes, the default
organisation, notification templates, the optional first admin, drops the
legacy `categories` concept, and provisions the RBAC catalogue
(`permissions` + `roles` collections with `admin`/`operator`/`viewer` system
roles).

## Environment

### `apps/api/.env`

Validated by zod at startup (`apps/api/src/config/env.ts`); a misconfigured
value crashes the process with a readable list of issues. The annotated
template lives at `apps/api/.env.example` — every key has local/prod guidance
inline.

**Required:**

| Var                  | Notes                                                          |
| -------------------- | -------------------------------------------------------------- |
| `MONGODB_URI`        | Must point at a **replica set** (Atlas, or `?replicaSet=rs0`). |
| `JWT_ACCESS_SECRET`  | ≥ 32 chars.                                                    |
| `JWT_REFRESH_SECRET` | ≥ 32 chars, **MUST differ** from `JWT_ACCESS_SECRET`.          |

**Optional groups (defaults in `env.ts` / `.env.example`):**

- App + HTTP: `NODE_ENV`, `PORT`, `API_PREFIX`
- JWT lifetimes: `JWT_ACCESS_TTL` (`15m`), `JWT_REFRESH_TTL` (`30d`)
- CORS / cookies: `CORS_ORIGIN` (comma-separated), `COOKIE_DOMAIN`,
  `COOKIE_SECURE`
- Rate limits: `RATE_LIMIT_AUTH_*`, `RATE_LIMIT_GLOBAL_*`,
  `RATE_LIMIT_PUBLIC_TRACK_*`
- Logging: `LOG_LEVEL`
- SMTP (empty → log to stdout): `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
  `SMTP_PASS`, `SMTP_FROM`
- Public web URL: `WEB_BASE_URL` (used in password-reset and tracking links)
- BullMQ: `REDIS_URL` (empty → in-process synchronous notification fallback)
- Telegram: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`
- Admin seed (idempotent): `ADMIN_EMAIL`, `ADMIN_PASSWORD` (≥ 10),
  `ADMIN_FULL_NAME`
- Multi-tenancy: `DEFAULT_ORG_ID` (24-hex ObjectId)
- S3-compatible storage for lot photos: `S3_ENDPOINT`, `S3_REGION`,
  `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_FORCE_PATH_STYLE`
  (`true` for MinIO/R2/Wasabi/B2, `false` for AWS S3)
- Lot photo limits: `LOT_PHOTO_MAX_BYTES` (10 MB), `LOT_PHOTO_MAX_COUNT`
  (10), `LOT_PHOTO_PRESIGNED_TTL_SECONDS` (3600)
- Branding: `ORG_NAME` (printed on every PDF + used as PDF `author` metadata)

### `apps/web/.env`

| Var               | Default   | Notes                                                          |
| ----------------- | --------- | -------------------------------------------------------------- |
| `VITE_API_URL`    | `/api/v1` | Override only when API is on a different origin in production. |
| `VITE_SOCKET_URL` | (empty)   | Override only when Socket.IO is on a different origin.         |

## Roadmap

| Stage | Scope                                                                      | Status  |
| ----- | -------------------------------------------------------------------------- | ------- |
| **0** | Foundation: TS/Express 5 + React 19/Vite 6/Tailwind 4 + shared + docker    | ✅ done |
| **1** | Auth + Users: refresh cookies + rotation + dynamic RBAC + admin UI         | ✅ done |
| **2** | Reference data: senders, carriers, exchange rates                          | ✅ done |
| **3** | Inventory: inboundLots + stock aggregation + lot photos (S3) + receipt PDF | ✅ done |
| **4** | Shipments: items + statusHistory + tracking + Socket.IO + waybill PDF      | ✅ done |
| **5** | Finance: transactions + multi-currency + balances + payment receipts       | ✅ done |
| **6** | Notifications: BullMQ + Telegram + templates                               | ✅ done |
| **7** | Reports + global search + CSV/XLSX export                                  | ✅ done |
| **8** | PWA + i18n (tr/ru/uz) + audit UI + dark theme                              | ✅ done |
| 9     | QA: Playwright + k6 + 2FA TOTP + coverage thresholds                       | next    |
| 10    | Pilot: Sentry + UptimeRobot + ops docs                                     | pending |

## Notable design decisions

- **npm workspaces** instead of pnpm — equivalent workspace semantics, fewer
  Linux tooling quirks.
- **TanStack Router** instead of React Router — file-based routing + stronger
  typing of params and search schemas.
- **CSRF defence** is `SameSite=Lax` on the refresh cookie + an
  `originCheck` middleware that validates Origin/Referer against the CORS
  allow-list on every unsafe method. Lax (not Strict) is required because
  prod web + api live on different Railway subdomains — the browser treats
  those as separate sites, and Strict would drop the cookie on every
  navigation.
- **Exchange rates** are entered manually by an admin (no cbu.uz cron) — see
  `/admin/exchange-rates`.
- **Notifications** ship Telegram only; no SMS provider wired in. Templates
  per `key + channel + language` live in `notificationTemplates`.
- **Lot photos** are stored on S3-compatible object storage (MinIO locally,
  Cloudflare R2 / AWS S3 in prod). Uploads pass through `sharp`
  (auto-rotate → resize 1600 → JPEG q=80) and are magic-byte validated via
  `file-type` — the declared `Content-Type` is never trusted. Reads use 1h
  presigned GET URLs.
- **`categories` removed** — the original concept (with seeded
  `Elektronik`/`Tekstil`/…) was dropped in favour of free-form lot labels.
- **PDF documents** (receipt, waybill, payment) are React components rendered
  server-side via `@react-pdf/renderer` with NotoSans VariableFont for
  Cyrillic + extended Turkish glyph support. Each document accepts a
  `language` prop (`tr`/`ru`/`uz`) and the web client forwards
  `?lang=<currentUiLang>` from every download link.
