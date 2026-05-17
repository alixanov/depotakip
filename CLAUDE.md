# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Source of truth

**Everything starts at [`depo-yonetim-tz.md`](./depo-yonetim-tz.md)** — the full technical
specification (v2.1, dated 2026-05-17). If the spec and this file disagree, the spec wins.

Domain identifiers stay Turkish (`sender/gönderici`, `carrier/kargocu`, `recipient/alıcı`,
`shipment/gönderi`, `lot`, `kategori`). Do not translate UI strings or field names.

## Monorepo layout

npm workspaces, three packages:

```
apps/
├── web/    @sadiyakargo/web    Vite 6 + React 19.2 + React Compiler + TS strict
└── api/    @sadiyakargo/api    Express 5 + Mongoose 8 + JWT + pino + zod (TS)
packages/
└── shared/ @sadiyakargo/shared zod schemas + TS types + domain constants
```

Root is `"type": "module"`. There is **one** `package-lock.json` in the repo root —
never create per-workspace lockfiles.

## Commands (run from repo root)

| Command                                       | What it does                                                             |
| --------------------------------------------- | ------------------------------------------------------------------------ |
| `npm install`                                 | Installs deps for all workspaces into a hoisted `node_modules/`.         |
| `npm run dev`                                 | Runs **both** apps in parallel (web :3000, api :4000) via `npm-run-all`. |
| `npm run dev:web`                             | Only the Vite dev server.                                                |
| `npm run dev:api`                             | Only the API with `tsx --watch`.                                         |
| `npm run build`                               | `build:api` (tsup → CJS) then `build:web` (Vite).                        |
| `npm run start:api`                           | `node --env-file=.env dist/server.cjs`.                                  |
| `npm test`                                    | Vitest + Supertest integration suite for the API.                        |
| `npm run lint`                                | ESLint 9 flat config + `eslint-plugin-react-compiler`.                   |
| `npm run typecheck`                           | `tsc --noEmit` for both `api` and `web`.                                 |
| `npm run format`                              | Prettier — write.                                                        |
| `npm run migrate:up`                          | `migrate-mongo up` against `MONGODB_URI`.                                |
| `npm run migrate:down`/ `:status` / `:create` | rollback / show history / scaffold.                                      |

`.husky/pre-commit` runs `lint-staged` over staged files only.

## Shared package (`packages/shared`)

The **single source of truth** for zod schemas, domain enums, and TS types.
Consumed as TypeScript source (no build step): `"main": "./src/index.ts"` with bundler
resolution (Vite for web, tsx/tsup for api).

- `src/constants.ts` — `STATUSES` (incl. `bekliyor`), `STATUS_LABELS`, `CURRENCIES`, `ROLES`,
  `TRANSACTION_KINDS`, `PAYMENT_METHODS`, `LOT_STATUSES`, `NOTIFICATION_*`, `DEFAULT_CATEGORIES`.
- `src/schemas/` — one file per domain (auth, user, sender, carrier, category, lot, shipment,
  transaction, exchangeRate, notification, common). Each file exports both the zod schema
  _and_ the `z.infer<...>` type.
- `src/types.ts` — denormalised domain types (`User`, `Sender`, `Carrier`, `InboundLot`,
  `Shipment`, `Transaction`, `Money`, etc.) used as API response types.

**Money everywhere** is `{ amount: number, currency: Currency }` where `amount` is in
**minor units** (cents/tiyin). Never use floats for monetary values.

## Backend (`apps/api`)

Express 5 + Mongoose 8 + zod + pino + JWT. TypeScript strict.

### Layout

```
apps/api/src/
├── server.ts                  – entry: env validation → db connect → listen + graceful shutdown
├── app.ts                     – express app (pino-http, helmet, cors, mongoSanitize, hpp,
│                                global rate-limit, routes, error handler)
├── config/
│   ├── env.ts                 – zod-validated process.env; crashes early on bad config
│   └── db.ts                  – mongoose connect/disconnect (parameterised for tests)
├── lib/
│   ├── errors.ts              – AppError + factories: badRequest/unauthorized/notFound/...
│   ├── asyncHandler.ts        – tiny wrapper kept for clarity (Express 5 forwards rejections natively)
│   ├── jwt.ts                 – signAccessToken/signRefreshToken + verifies
│   ├── password.ts            – bcrypt cost 12
│   └── logger.ts              – pino + pino-pretty in dev; redacts Authorization/Cookie/password*
├── middleware/
│   ├── auth.ts                – requireAuth (Bearer JWT → req.userId/role/orgId) + requireRole
│   ├── validate.ts            – zod request validator: { body?, params?, query? }
│   ├── error.ts               – central handler → { error, code, details? }
│   └── notFound.ts            – 404 fallback
├── modules/
│   ├── health/                – /api/v1/health  (added in Etap 0)
│   ├── auth/                  – Etap 1
│   ├── users/                 – Etap 1
│   ├── senders/, carriers/, categories/   – Etap 2
│   ├── lots/                  – Etap 3
│   ├── shipments/             – Etap 4
│   ├── transactions/, balances/, exchangeRates/   – Etap 5
│   └── notifications/         – Etap 6
└── migrations are CJS files in apps/api/migrations/*.cjs
```

### Conventions (binding)

- **Per-org + per-user scoping is non-negotiable.** Every query against tenant-scoped
  collections MUST include `orgId: req.orgId`. Resource fetches additionally check
  `userId` where the resource is per-user.
- **Roles:** `admin` / `operator` / `viewer`. Admin = full. Operator = CRUD on operations,
  no user management. Viewer = read-only, optionally no financial figures.
- **Validation happens in middleware** via zod schemas from `@sadiyakargo/shared`. Controllers
  receive already-parsed `req.body` / `req.params` / `req.query` and never re-check shape.
- **Errors throw `AppError` or its factory wrappers** from `lib/errors.ts`. The central
  middleware maps mongoose CastError → 400, ValidationError → 422, duplicate-key → 409.
  Don't write your own try/catch → res.status branches.
- **Repositories own mongoose.** Services depend on repositories, not models, so services
  are easy to fake in unit tests. Don't import a model from a controller or another module.
- **All tenant-scoped mutating routes are auth-protected** (`router.use(requireAuth)` at
  the top of each feature router). Health and auth routes are the only exceptions.
- **Idempotency:** `POST /shipments` and `POST /transactions` honour the `Idempotency-Key`
  header — middleware checks `idempotencyKeys` collection before executing.
- **Soft delete:** all tenant collections carry `deletedAt: Date | null`. Use the
  `notDeleted()` query helper; never hard-delete in service code.
- **Money in minor units** as `{ amount, currency }`. Never floats. Conversion uses snapshot
  of exchange rate on the transaction date (`exchangeRateToUsd`).
- **MongoDB transactions** (`session.withTransaction`) for shipment create/cancel and any
  multi-document write that touches `qtyAvailable`. Requires replica set (docker-compose
  ships single-node rs0 for dev; Atlas in prod).
- **Audit log** is written by global middleware for every mutation (POST/PATCH/PUT/DELETE).
  PII (phones) masked as `***1234` in `auditLog.diff`.

### Security stack (TZ §9)

- `helmet` (default CSP/HSTS/X-Frame-Options)
- `cors` with allow-listed origins
- `express-mongo-sanitize` + `hpp`
- `express-rate-limit`: global (300/min) + tight auth (10/15min) + tight public-track (20/min)
- JWT: short access (15m) + httpOnly Secure SameSite=Lax refresh cookie (30d) with **rotation**
- CSRF: SameSite=Strict + Origin/Referer check (chosen alternative to double-submit)
- bcrypt cost 12; password ≥ 10 chars
- File uploads validated via `file-type` (not Content-Type) — Etap 3 (planned)
- 2FA TOTP via `speakeasy` — Etap 9 (planned)

### Environment (`apps/api/.env`)

Validated by zod at startup. Required: `MONGODB_URI`, `JWT_ACCESS_SECRET` (≥32), `JWT_REFRESH_SECRET` (≥32).
Optional with sensible defaults: `PORT` (4000), `API_PREFIX` (`/api/v1`), `JWT_ACCESS_TTL` (`15m`),
`JWT_REFRESH_TTL` (`30d`), `CORS_ORIGIN`, all `RATE_LIMIT_*`, `LOG_LEVEL`, `DEFAULT_ORG_ID`.

## Frontend (`apps/web`)

Vite 6 + React 19.2 + React Compiler + TypeScript strict + Tailwind 4 + shadcn/ui +
TanStack Router (file-based) + TanStack Query + Zustand + react-hook-form + lucide-react.

### Layout (target — Etap 0 only contains the skeleton)

```
apps/web/src/
├── main.tsx                   – ReactDOM root + providers (QueryClient, RouterProvider)
├── routes/                    – TanStack Router file-based: __root.tsx + per-route .tsx files
│                                generates routeTree.gen.ts (ignored by ESLint/Prettier)
├── components/ui/             – shadcn primitives (button, input, dialog, sonner, etc.)
├── components/                – non-ui shared components (cards, layouts)
├── features/                  – one folder per domain feature (auth, depo, cikis, finans, etc.)
│                                each with its own components + hooks (useFeatureNameQuery)
├── stores/                    – Zustand stores (auth, ui)
├── lib/
│   ├── env.ts                 – API_BASE / SOCKET_URL from import.meta.env
│   ├── utils.ts               – cn() (clsx + tailwind-merge)
│   ├── api/client.ts          – fetch wrapper + ApiError + Idempotency-Key support
│   └── format.ts              – formatDate (tr-TR), money formatters
└── styles.css                 – @import "tailwindcss" + design tokens (CSS variables)
```

### Conventions

- **React 19 features actively used:** `use()` for promise/context unwrapping; Actions for
  forms (`<form action={...}>` + `useActionState`); `useOptimistic` for status changes
  and payments; ref as a regular prop (no `forwardRef`); Document Metadata for page titles.
- **React Compiler** is on (Vite babel plugin) — **do not add manual `useMemo`/`useCallback`**
  except where Compiler reports a bailout in dev. To opt a file out, add `'use no memo'`.
- **Server state lives in TanStack Query**. Each feature owns its hooks
  (`useSendersQuery`, `useCreateSender`, etc.). `useMutation.onSuccess` updates the
  cache with `qc.setQueryData` (no full refetch) and invalidates sibling queries
  cross-feature when needed.
- **Client/UI state lives in Zustand or `useState`.** Don't put form drafts into Query cache.
- **Forms use react-hook-form + zodResolver** with schemas from `@sadiyakargo/shared`.
- **All requests go through `lib/api/client.ts`.** It auto-attaches the access token from
  Zustand, sets `Idempotency-Key` when supplied, unwraps `{ error, code, fields }` into
  `ApiError`, and on 401 clears the auth store.
- **Theme values come from `styles.css` CSS variables** (shadcn pattern: `bg-primary`,
  `text-foreground`, etc.). No literal hex colours in new components.
- **Status colours come from `STATUS_LABELS` in `@sadiyakargo/shared`**; do not duplicate.
- **Path imports use `@/` for `src/`**. Workspace deps via `@sadiyakargo/shared` resolve
  through the symlink with bundler resolution.
- **Icons:** `lucide-react` only. No emoji in production code (the spec calls for an
  icon library; emoji can stay for placeholder text but not as primary UI).

### UI structure (TZ Appendix A)

9 tabs: Ana Sayfa / Depo / Göndericiler / Kargocular / Çıkış / Takip / Finans / Raporlar /
Ayarlar. Mobile bottom-nav shows 5 most-used + "Menü" overflow. Touch targets ≥ 44 × 44 px.
Mobile-first; tablet/desktop becomes a centered card via Tailwind responsive utilities.

## Tooling

- **ESLint 9 flat config** (`eslint.config.js`) with separate scopes for backend TS, frontend
  TS+React+`react-compiler`, and CJS migrations. Prettier compatibility via
  `eslint-config-prettier`.
- **Prettier** (`.prettierrc.json`) — `printWidth 100`, double quotes, trailing comma ES5.
- **Husky + lint-staged** — pre-commit runs ESLint --fix + Prettier on staged files only.
- **Strict TS** everywhere — no `any`, no `as any` workarounds. If a type fights you,
  fix the underlying shape rather than escape-hatching.

## When in doubt

Re-read [`depo-yonetim-tz.md`](./depo-yonetim-tz.md). If still in doubt, ask the user.
Communicate with the user in Russian per session preference; keep code identifiers Turkish.
