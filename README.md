# Depo Yönetim Sistemi — Monorepo

Warehouse & shipment management system for Uzbekistan → Turkey logistics.
React 19 + Express 5 + MongoDB + TypeScript end-to-end, organised as an npm-workspaces monorepo.

**Source of truth:** [`depo-yonetim-tz.md`](./depo-yonetim-tz.md) — full technical specification (TZ v2.1).
This README only documents how to run the codebase; the spec drives the roadmap.

## Workspaces

```
depotakip/
├── apps/
│   ├── web/    @sadiyakargo/web    Vite 6 + React 19 + React Compiler + Tailwind 4 + shadcn/ui
│   │                             + TanStack Router + TanStack Query + Zustand + react-hook-form
│   └── api/    @sadiyakargo/api    Express 5 + Mongoose 8 + JWT (refresh-cookies) + pino + helmet
│                                 + zod validation + feature-based modules
├── packages/
│   └── shared/ @sadiyakargo/shared Zod schemas + TS types + domain constants (single source)
├── docker-compose.yml            mongo replicaSet + redis + minio
└── .github/workflows/ci.yml      lint + typecheck + build + test on PR
```

## Prerequisites

- **Node.js ≥ 22** (developed/tested on 24.x; CI runs 22 LTS)
- **npm ≥ 10**
- **Docker** (for local mongo replica set, redis, minio) — or external Atlas/Upstash/R2

## Setup

```bash
git clone <repo> && cd depotakip
npm install                      # installs deps for all workspaces

cp apps/api/.env.example apps/api/.env
# Generate two strong secrets (≥ 32 chars each):
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
# paste into JWT_ACCESS_SECRET and JWT_REFRESH_SECRET in apps/api/.env
# Optionally set ADMIN_EMAIL + ADMIN_PASSWORD to seed the first admin user

docker compose up -d             # mongo (rs0), redis, minio
npm run migrate:up               # creates indexes + seeds categories + notification templates
                                 # + first admin if ADMIN_EMAIL/PASSWORD are set
```

Husky pre-commit hook is wired by `npm install` (via the `prepare` script).

## Running in development

```bash
npm run dev                      # web :3000 + api :4000 in parallel
npm run dev:web                  # only the Vite dev server
npm run dev:api                  # only the API with tsx --watch
```

The web app proxies `/api/*` to `http://localhost:4000` in dev (see `apps/web/vite.config.ts`).
The API mounts everything under `/api/v1` (configurable through `API_PREFIX`).

## Production

```bash
npm run build                    # tsup → dist/server.cjs + vite build → build/
npm run start:api                # node --env-file=.env dist/server.cjs
```

Serve `apps/web/build/` with any static host and reverse-proxy `/api/*` to the API process.
Set `VITE_API_URL` at build time if the API lives on a different origin.

## Quality

| Script                 | What it does                                                                  |
| ---------------------- | ----------------------------------------------------------------------------- |
| `npm run lint`         | ESLint 9 flat config with `eslint-plugin-react-compiler` over all workspaces. |
| `npm run format`       | Prettier — write changes to every supported file.                             |
| `npm run format:check` | Prettier — read-only check (CI mode).                                         |
| `npm run typecheck`    | `tsc --noEmit` for both `api` and `web`.                                      |
| `npm test`             | Vitest + Supertest integration tests for the API (in-memory MongoDB).         |

`pre-commit` (Husky) runs `lint-staged`: ESLint + Prettier on staged files only.

## Migrations

```bash
npm run migrate:up               # apply pending migrations
npm run migrate:down             # roll back the last migration
npm run migrate:status           # show migration history
npm run migrate:create -- name   # scaffold a new migration file
```

History lives in the `_migrations` collection. Migration files are CJS (`apps/api/migrations/*.cjs`).

## Environment

### `apps/api/.env`

Validated by zod at startup (`apps/api/src/config/env.ts`); a misconfigured value crashes
the process with a readable list of issues. See `.env.example` for defaults.

Required:

- `MONGODB_URI` — needs a **replica set** (Atlas, or `?replicaSet=rs0` against docker compose)
- `JWT_ACCESS_SECRET` — ≥ 32 chars
- `JWT_REFRESH_SECRET` — ≥ 32 chars

### `apps/web/.env`

| Var               | Default   | Notes                                                          |
| ----------------- | --------- | -------------------------------------------------------------- |
| `VITE_API_URL`    | `/api/v1` | Override only when API is on a different origin in production. |
| `VITE_SOCKET_URL` | (empty)   | Used in Etap 4 when Socket.IO is wired up.                     |

## Roadmap

Implementation follows the 11 stages laid out in `depo-yonetim-tz.md` §11:

| Stage | Scope                                                                   | Status  |
| ----- | ----------------------------------------------------------------------- | ------- |
| **0** | Foundation: TS/Express 5 + React 19/Vite 6/Tailwind 4 + shared + docker | ✅ done |
| **1** | Auth + Users: refresh cookies + ротация + RBAC + UsersPage admin        | ✅ done |
| **2** | Reference data: categories, senders, carriers, exchange rates           | ✅ done |
| **3** | Inventory: inboundLots + stock aggregation + PDF receipt                | ✅ done |
| **4** | Shipments: items + statusHistory + tracking + Socket.IO + waybill       | ✅ done |
| **5** | Finance: transactions + multi-currency + balances + receipts            | ✅ done |
| **6** | Notifications: BullMQ + Telegram + templates                            | ✅ done |
| **7** | Reports + global search + CSV/XLSX export                               | ✅ done |
| **8** | PWA + i18n + audit UI + dark theme                                      | ✅ done |
| 9     | QA: Playwright + k6 + 2FA + coverage thresholds                         | next    |
| 10    | Pilot: Sentry + UptimeRobot + docs                                      | pending |

## Deviations from TZ

These differ from the spec by explicit user decision (not by accident):

- **npm** instead of pnpm (TZ §4.4) — equivalent workspaces, no Linux tooling friction.
- **TanStack Router** instead of React Router 7 (TZ §4.1) — file-based routing + stronger typing.
- **SameSite=Strict + Origin check** instead of double-submit cookie (TZ §9) — equivalent CSRF defence.
- **Manual exchange-rate entry** instead of cbu.uz cron (TZ §5.9) — admin enters rates.
- **No SMS provider**, Telegram only (TZ §6.10) — Eskiz wiring postponed.
- **No photo uploads in Etap 3** — postponed; lots created without photos initially.
