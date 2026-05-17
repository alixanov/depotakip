# Техническое задание

## Система управления складом и грузоперевозками «Depo Yönetim Sistemi»

**Версия документа:** 2.1 (стек React 19.2 + Express + MongoDB, Node.js 24.15 LTS)
**Дата:** 2026-05-17
**Язык интерфейса:** турецкий (TR), админ-панель допускает русские подсказки.
**Маршрут бизнеса:** Узбекистан (склад) → Турция (доставка).

---

## 1. Цели и контекст бизнеса

Компания принимает товар на склад в Узбекистане (как собственный, так и от сторонних отправителей), формирует партии и передаёт нанятым карго-перевозчикам для доставки получателям в Турции. Требуется единая система, которая:

1. Ведёт **точный складской остаток** с привязкой к отправителю и партии.
2. Управляет жизненным циклом отправки (приём → склад → передача в карго → в пути → доставлено / проблемная).
3. Ведёт **финансы**: расчёты с перевозчиками (долги), расчёты с отправителями товара, мультивалютность (USD/UZS/TRY).
4. **Уведомляет** клиентов и перевозчиков об изменении статуса груза через SMS / Telegram.
5. **Формирует документы** (приёмная расписка, накладная при отгрузке, акт сверки) в PDF.
6. Хранит **фото товара** при приёмке.
7. Доступна **с нескольких устройств** и нескольким сотрудникам с разграничением прав.

Текущий прототип (React-SPA с локальным `window.storage`) переделывается в полноценное клиент-серверное приложение на стеке **MERN** (MongoDB + Express + React + Node.js).

---

## 2. Глоссарий

| Термин                              | Значение                                                                          |
| ----------------------------------- | --------------------------------------------------------------------------------- |
| **Mal / Товар**                     | Учётная единица — натуральные штуки одной категории.                              |
| **Категория (kategori)**            | Тип товара: Elektronik, Tekstil, Gıda и т. д. Справочник редактируемый.           |
| **Партия прихода (lot)**            | Один акт поступления на склад: «20 шт. электроники от клиента X на дату Y».       |
| **Отправитель (sender, gönderici)** | Клиент, передавший товар на склад. Может быть «собственным» (виртуальный sender). |
| **Перевозчик (carrier, kargocu)**   | Физлицо / компания, забирающая груз для доставки в Турцию.                        |
| **Получатель (recipient, alıcı)**   | Конечный адресат груза в Турции.                                                  |
| **Отправка (shipment, gönderi)**    | Передача одной или нескольких партий перевозчику.                                 |
| **Статус**                          | `bekliyor` / `yolda` / `teslim` / `kayip` / `borclu` / `iptal`.                   |
| **Платёж**                          | Денежная транзакция от перевозчика или отправителя в адрес компании.              |
| **Долг**                            | Невыплаченный остаток по перевозчику или отправителю в базовой валюте.            |

---

## 3. Роли и права доступа

| Роль         | Возможности                                                                                                                         |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| **admin**    | Всё. Управление пользователями, справочниками, тарифами, курсами, шаблонами уведомлений. Просмотр audit-log. Удаление записей.      |
| **operator** | Приёмка, оформление отправок, смена статусов, регистрация платежей, печать документов. Без удаления, без управления пользователями. |
| **viewer**   | Только чтение списков и отчётов. Без действий и без финансовых сумм (опционально).                                                  |

Авторизация: email + пароль. **JWT access-токен** (срок 15 минут) + **refresh-токен** в httpOnly cookie (срок 30 дней). Восстановление пароля по email через одноразовый токен. Принудительная смена пароля при первом входе (если создан админом).

---

## 4. Технологический стек

### 4.1. Frontend

| Слой                | Технология                                                                                                                          | Версия                           |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------- |
| Базовый             | **React**                                                                                                                           | **19.2.x**                       |
| React Compiler      | `babel-plugin-react-compiler` (стабильный для 19.x)                                                                                 | latest                           | автоматическая мемоизация — отказываемся от ручных `useMemo`/`useCallback` |
| Язык                | **TypeScript**                                                                                                                      | 5.6+ (поддержка `ref` как prop)  |
| Сборщик             | **Vite**                                                                                                                            | 6.x                              |
| Роутинг             | **React Router**                                                                                                                    | 7.x (data-mode, без RSC для SPA) |
| Серверное состояние | **TanStack Query**                                                                                                                  | 5.x                              |
| Локальное состояние | **Zustand**                                                                                                                         | 5.x                              |
| Формы               | **react-hook-form** + **zod** + нативные **React 19 Actions** (`useActionState`, `useFormStatus`, `useOptimistic`) для простых форм |
| HTTP                | **axios** (с interceptors для refresh JWT) — либо нативный `fetch` + лёгкая обёртка                                                 |
| Realtime            | **socket.io-client**                                                                                                                | 4.x                              |
| UI-компоненты       | **Tailwind CSS 4** + **shadcn/ui** (Radix UI; обновлённая версия под React 19, без `forwardRef`)                                    |                                  |
| Графики             | **Recharts**                                                                                                                        |                                  |
| PDF                 | **@react-pdf/renderer**                                                                                                             |                                  |
| Дата/время          | **date-fns**                                                                                                                        |                                  |
| i18n                | **i18next** + **react-i18next**                                                                                                     |                                  |
| PWA                 | **vite-plugin-pwa** (Workbox)                                                                                                       |                                  |
| Иконки              | **lucide-react**                                                                                                                    |                                  |
| Линтинг             | **ESLint 9** (flat config) + Prettier + `eslint-plugin-react-compiler`                                                              |
| Тесты               | Vitest 2.x + React Testing Library + Playwright                                                                                     |

**React 19 — что используем:**

- **`use()` hook** — для разворачивания промисов в Suspense (заменяет часть TanStack Query-обвязки в редких случаях) и условного чтения контекстов (например, темы внутри ветки).
- **Ref как обычный prop** — убираем `React.forwardRef` во всех собственных компонентах; стандартизирует API shadcn-обёрток.
- **Actions** — для форм платежей и смены статуса: `<form action={updateStatusAction}>` + `useActionState` для серверной ошибки и pending-флага, без двойного состояния в `useState`.
- **`useOptimistic`** — для мгновенного отображения изменений (смена статуса, регистрация платежа) без TanStack Query optimistic-update boilerplate.
- **`useFormStatus`** — pending-флаг кнопок submit без проброса пропсов.
- **Document Metadata** (`<title>`, `<meta>` прямо в компоненте) — для динамических заголовков страниц без `react-helmet`.
- **Asset Loading** (`preload`, `preinit`) — для предзагрузки PDF-шрифтов и роутов на hover.
- **`<Activity />`** — фоновая предзагрузка следующего вероятного экрана (например, «Отгрузка» после выбора перевозчика).
- **React Compiler** включается через Vite-плагин; отключаются явно через `'use no memo'` в файлах, где автомемоизация ломает диагностику.

### 4.2. Backend

| Слой              | Технология                                                                            | Версия                            |
| ----------------- | ------------------------------------------------------------------------------------- | --------------------------------- |
| Runtime           | **Node.js**                                                                           | **24.15.x LTS**                   |
| Веб-фреймворк     | **Express**                                                                           | **5.x** (стабилен с октября 2024) |
| Язык              | **TypeScript**                                                                        | 5.6+                              |
| ODM               | **Mongoose**                                                                          | 8.x                               |
| Валидация         | **zod** (общая со фронтом через `packages/shared-types`)                              |
| Аутентификация    | **jsonwebtoken** + **bcrypt** (cost 12)                                               |
| Загрузка файлов   | **multer** + **sharp** (сжатие/ресайз)                                                |
| Хранилище файлов  | **@aws-sdk/client-s3 v3** (S3 / Cloudflare R2 / MinIO)                                |
| Realtime          | **socket.io**                                                                         | 4.x                               |
| Шедулер           | **node-cron** (курсы валют, повторы уведомлений)                                      |
| HTTP-клиент       | **встроенный `fetch`** (стабильный в Node 24) — без `node-fetch` / `axios` на сервере |
| SMS               | **eskiz-uz-sdk** (для +998), **twilio** (резерв)                                      |
| Telegram          | **telegraf**                                                                          |
| Логирование       | **pino** + pino-pretty в dev, JSON в проде                                            |
| Метрики           | **prom-client** (Prometheus)                                                          | опционально                       |
| Мониторинг ошибок | **Sentry Node SDK**                                                                   |
| Безопасность      | **helmet**, **cors**, **express-rate-limit**, **express-mongo-sanitize**, **hpp**     |
| Тесты             | **Vitest 2.x** + **supertest** (integration), **mongodb-memory-server** для unit      |
| API-документация  | **swagger-jsdoc** + **swagger-ui-express** (OpenAPI 3)                                |

**Node.js 24 — что используем:**

- **Встроенный `fetch` + WebSocket-клиент** — выкидываем `node-fetch` и `axios` на бэкенде, используем `fetch()` напрямую для вызовов Eskiz/Twilio/Telegram API. AbortController встроен.
- **`node --env-file=.env.production`** — нативная подгрузка `.env` без `dotenv` в проде. `dotenv` остаётся только для удобства локальной разработки с несколькими файлами.
- **Permission Model** (`node --permission --allow-fs-read=/app --allow-fs-write=/app/uploads`) — дополнительный слой защиты в production-контейнере: явно разрешаем чтение/запись только нужных директорий и сетевые хосты MongoDB/S3.
- **Встроенный `node:test`** не используем (остаёмся на Vitest для единого runner с фронтом и watch-mode).
- **`node --experimental-strip-types`** — только для скриптов разработки (миграции, сиды). Прод — собранный JS через `tsc` или `tsup`.
- **`structuredClone`**, **`AbortSignal.timeout()`**, **`AbortSignal.any()`** — используем для тайм-аутов в HTTP-клиентах и операциях с базой.
- **`util.styleText`** — для подсвечивания pino-pretty альтернатив в локальных скриптах.

**Express 5** — поддержка `async/await` в обработчиках без `express-async-errors` (ошибки автоматически передаются в error middleware), обновлённый router без устаревших путей в стиле `*`.

### 4.3. Инфраструктура

| Назначение       | Решение                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------ |
| База данных      | **MongoDB Atlas** (M10+ для продакшна; обязательно **replica set** — нужен для транзакций) |
| Файлы            | **AWS S3** / **Cloudflare R2** (S3-совместимое, дешевле) / **MinIO** на VPS для самохоста  |
| Бэкенд-хостинг   | **Railway** / **Render** / **Fly.io** / VPS под PM2 + Nginx                                |
| Фронтенд-хостинг | **Vercel** / **Netlify** / Nginx static                                                    |
| CDN              | Cloudflare (бесплатный план)                                                               |
| CI/CD            | **GitHub Actions** (lint → typecheck → test → build → deploy)                              |
| Контейнеризация  | Docker + docker-compose (опционально для self-hosted)                                      |
| Reverse proxy    | Nginx с TLS (Let's Encrypt через certbot)                                                  |

### 4.4. Структура репозитория (монорепо)

```
depo-yonetim/
├── apps/
│   ├── web/                   # React-фронтенд (Vite)
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   ├── features/
│   │   │   ├── components/ui/
│   │   │   ├── hooks/
│   │   │   ├── lib/api/       # axios instance + interceptors
│   │   │   ├── lib/socket.ts
│   │   │   ├── stores/
│   │   │   └── i18n/
│   │   ├── public/
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   └── api/                   # Express-бэкенд
│       ├── src/
│       │   ├── config/
│       │   ├── models/        # Mongoose-схемы
│       │   ├── controllers/
│       │   ├── routes/
│       │   ├── middleware/    # auth, rbac, validation, error
│       │   ├── services/      # бизнес-логика (transactions, notifications)
│       │   ├── jobs/          # cron: курсы валют, повторы
│       │   ├── sockets/
│       │   ├── utils/
│       │   └── app.ts
│       ├── tests/
│       └── package.json
│
├── packages/
│   ├── shared-types/          # zod-схемы и типы DTO, общие
│   └── pdf-templates/         # @react-pdf/renderer компоненты документов
│
├── docker-compose.yml         # mongo + minio + api + web для локалки
├── .github/workflows/
├── pnpm-workspace.yaml        # pnpm как менеджер монорепо
└── package.json
```

---

## 5. Модель данных (MongoDB)

Все коллекции содержат:

- `_id: ObjectId` (генерируется автоматически)
- `createdAt`, `updatedAt` (через `{ timestamps: true }`)
- `createdBy`, `updatedBy: ObjectId → users` (через мидлварь)
- `deletedAt: Date | null` (мягкое удаление; запросы через query helper `notDeleted()`)
- `orgId: ObjectId` (мультитенантность, на будущее)

Денежные суммы хранятся в **минорных единицах** (центы / тийины) как `Int32`, чтобы исключить плавающую точку. Поля сумм: `amount` + `currency`.

### 5.1. `users`

```js
{
  _id, email (unique, lowercase, indexed),
  passwordHash,                  // bcrypt cost 12
  fullName, phone,
  role: 'admin' | 'operator' | 'viewer',
  active: Boolean,
  twoFactorSecret: String | null,    // TOTP, опционально для admin
  refreshTokens: [{ token, userAgent, ip, issuedAt, expiresAt }],
  passwordResetToken, passwordResetExpiresAt,
  lastLoginAt
}
```

**Индексы:** `{ email: 1 }` unique, `{ orgId: 1, role: 1 }`.

### 5.2. `senders` — отправители

```js
{
  _id, orgId,
  fullName, phone (E.164),
  telegramChatId: Number | null,
  address: String,
  notes: String,
  isSelf: Boolean,               // true = собственный товар компании
}
```

**Индексы:** `{ orgId: 1, phone: 1 }`, `{ orgId: 1, fullName: 'text' }`.

### 5.3. `carriers` — перевозчики

```js
{
  _id, orgId,
  firstName, lastName, phone,
  telegramChatId: Number | null,
  deliveryAddressTr: String,
  notes: String,
}
```

**Индексы:** `{ orgId: 1, phone: 1 }`, текстовый по `firstName lastName`.

### 5.4. `categories` — справочник категорий

```js
{
  _id, orgId,
  name (unique within orgId),
  icon: String,                  // emoji или ключ иконки
  sortOrder: Number,
  active: Boolean,
}
```

Сидируется: Elektronik, Tekstil, Gıda, Kozmetik, Aksesuar, Diğer.

### 5.5. `inboundLots` — приходы на склад

```js
{
  _id, orgId,
  senderId: ObjectId → senders,
  categoryId: ObjectId → categories,
  qtyIn: Number,                 // > 0
  qtyAvailable: Number,          // денормализовано, обновляется в транзакции
  unitPrice: { amount: Number, currency: 'USD'|'UZS'|'TRY' } | null,
  receivedAt: Date,
  notes: String,
  status: 'in_stock' | 'partially_shipped' | 'fully_shipped' | 'withdrawn',
  photos: [{                     // встроенный массив
    storageKey: String,          // ключ в S3/R2
    mimeType: String,
    sizeBytes: Number,
    width, height,
    uploadedAt: Date,
  }],
}
```

**Индексы:** `{ orgId: 1, senderId: 1, status: 1 }`, `{ orgId: 1, categoryId: 1, qtyAvailable: 1 }`, `{ orgId: 1, receivedAt: -1 }`.

**Инвариант:** `qtyAvailable = qtyIn - sum(активных shipmentItems по этому lotId)`. Поддерживается транзакционно при создании/отмене отправок.

### 5.6. `shipments` — отправки

```js
{
  _id, orgId,
  shortCode: String,             // человекочитаемый: SH-2026-00123 (через counter)
  carrierId: ObjectId → carriers,
  recipient: {
    name, phone, addressTr,      // плоский объект, не отдельная коллекция
  } | null,
  shipmentDate: Date,
  carrierFee: { amount, currency },
  status: 'bekliyor' | 'yolda' | 'teslim' | 'kayip' | 'borclu' | 'iptal',
  items: [{                      // встроенный массив позиций
    _id: ObjectId,
    lotId: ObjectId → inboundLots,
    qty: Number,                 // > 0
    senderCharge: { amount, currency } | null,
  }],
  statusHistory: [{              // встроено, история до ~20 записей нормально
    fromStatus, toStatus,
    changedBy: ObjectId → users,
    changedAt: Date,
    comment: String,
    proofPhoto: { storageKey, ... } | null,
  }],
  publicTrackingToken: String,   // случайная строка для /track/:token
  notes: String,
}
```

**Индексы:** `{ orgId: 1, carrierId: 1, status: 1 }`, `{ orgId: 1, status: 1, shipmentDate: -1 }`, `{ orgId: 1, shortCode: 1 }` unique, `{ publicTrackingToken: 1 }` unique, `{ 'items.lotId': 1 }`.

### 5.7. `counters` — генератор последовательностей

```js
{ _id: 'shipment_2026', seq: Number }
```

Атомарный инкремент через `findOneAndUpdate({ $inc: { seq: 1 } }, { upsert: true })`.

### 5.8. `transactions` — финансовые операции

```js
{
  _id, orgId,
  kind: 'carrier_charge' | 'carrier_payment'
      | 'sender_charge'  | 'sender_payment'
      | 'adjustment',
  counterparty: {
    type: 'carrier' | 'sender',
    id: ObjectId,
  },
  shipmentId: ObjectId → shipments | null,
  amount: Number,                // > 0, в минорных единицах
  currency: 'USD' | 'UZS' | 'TRY',
  direction: 'debit' | 'credit', // debit увеличивает долг контрагента
  txDate: Date,
  exchangeRateToUsd: Number,     // snapshot курса на дату tx
  amountUsdSnapshot: Number,     // в USD-центах, для быстрых сумм
  method: 'cash' | 'bank' | 'card' | 'other',
  receipt: { storageKey, mimeType, ... } | null,
  notes: String,
  reversesTransactionId: ObjectId | null,   // для adjustment при отмене
}
```

**Индексы:** `{ orgId: 1, 'counterparty.type': 1, 'counterparty.id': 1, txDate: -1 }`, `{ orgId: 1, shipmentId: 1 }`, `{ orgId: 1, txDate: -1 }`.

### 5.9. `exchangeRates`

```js
{
  _id,
  currency: 'UZS' | 'TRY' | ...,
  rateToUsd: Number,             // float, точность 8 знаков
  rateDate: Date,                // только дата, без времени
  source: 'cbu' | 'manual',
}
```

**Индекс:** `{ currency: 1, rateDate: -1 }` unique. Обновляется cron'ом раз в сутки из `cbu.uz`.

### 5.10. `notificationLog`

```js
{
  _id, orgId,
  channel: 'sms' | 'telegram',
  recipientType: 'sender' | 'carrier' | 'recipient',
  recipientRef: { id: ObjectId | null, phone: String | null, chatId: Number | null },
  templateKey: String,
  payload: Object,
  renderedText: String,
  status: 'queued' | 'sent' | 'failed',
  attempts: Number,
  providerResponse: Object,
  sentAt: Date | null,
  errorMessage: String | null,
}
```

**Индексы:** `{ orgId: 1, status: 1, createdAt: -1 }`, TTL-индекс на `createdAt` 365 дней.

### 5.11. `notificationTemplates`

```js
{
  _id, orgId,
  key: 'shipment_yolda',         // фиксированный набор ключей
  channel: 'sms' | 'telegram',
  language: 'tr' | 'ru' | 'uz',
  body: String,                  // плейсхолдеры {{var}}
  active: Boolean,
}
```

**Индекс:** `{ orgId: 1, key: 1, channel: 1, language: 1 }` unique.

### 5.12. `auditLog`

```js
{
  _id, orgId,
  userId: ObjectId,
  action: 'create' | 'update' | 'delete' | 'login' | 'export' | 'status_change',
  entityType: String,
  entityId: ObjectId,
  diff: Object,                  // { before, after } — только изменённые поля
  ip: String,
  userAgent: String,
  at: Date,
}
```

**Индексы:** `{ orgId: 1, at: -1 }`, `{ entityType: 1, entityId: 1 }`. TTL 2 года.

### 5.13. Транзакции MongoDB (ACID)

Используется `session.withTransaction()` для критичных операций:

1. **Создание отправки:** `inboundLots.qtyAvailable -= qty` + insert `shipment` + insert N `transactions`.
2. **Отмена отправки** (`status = 'iptal'`): `inboundLots.qtyAvailable += qty` + insert reverse `transactions`.
3. **Регистрация платежа:** insert `transaction` + пересчёт балансов в кэш (опционально).

> **Обязательно:** MongoDB должна быть в режиме replica set. На Atlas — по умолчанию.

### 5.14. Расчёт балансов

Балансы вычисляются on-the-fly через aggregation pipeline:

```js
// Псевдокод
db.transactions.aggregate([
  { $match: { orgId, "counterparty.type": "carrier", "counterparty.id": carrierId } },
  {
    $group: {
      _id: null,
      debitUsd: { $sum: { $cond: [{ $eq: ["$direction", "debit"] }, "$amountUsdSnapshot", 0] } },
      creditUsd: { $sum: { $cond: [{ $eq: ["$direction", "credit"] }, "$amountUsdSnapshot", 0] } },
    },
  },
  { $project: { balanceUsd: { $subtract: ["$debitUsd", "$creditUsd"] } } },
]);
```

Для производительности — материализованный view `carrierBalances` обновляется триггером на запись `transactions` (через change stream worker или explicit recalc после mutation).

### 5.15. Текущий остаток

- **Быстрый запрос** «сколько на складе всего по категории»: агрегация по `inboundLots` с `$match: { qtyAvailable: { $gt: 0 } }` + `$group` по `categoryId`. С индексом `{ orgId: 1, categoryId: 1, qtyAvailable: 1 }` это O(log n).
- **Остаток по отправителю**: аналогично с `$group: senderId`.
- **Детально по партиям**: прямой запрос с фильтрами.

---

## 6. Функциональные требования

### 6.1. Аутентификация (REST API)

| Метод | Эндпоинт                    | Описание                                     |
| ----- | --------------------------- | -------------------------------------------- |
| POST  | `/api/auth/login`           | email + password → access + refresh (cookie) |
| POST  | `/api/auth/refresh`         | refresh cookie → новый access                |
| POST  | `/api/auth/logout`          | инвалидация refresh-токена                   |
| POST  | `/api/auth/forgot-password` | отправка письма со ссылкой                   |
| POST  | `/api/auth/reset-password`  | смена пароля по токену                       |
| GET   | `/api/auth/me`              | текущий пользователь                         |
| POST  | `/api/auth/2fa/enable`      | включить TOTP                                |
| POST  | `/api/auth/2fa/verify`      | подтвердить код                              |

**Middleware:** `requireAuth` (валидирует JWT, кладёт `req.user`), `requireRole(...roles)`.

### 6.2. Управление пользователями (admin)

- `GET /api/users` — список с пагинацией.
- `POST /api/users` — создание (отправляет invite-email с временным паролем).
- `PATCH /api/users/:id` — смена роли, деактивация.
- `DELETE /api/users/:id` — мягкое удаление.

### 6.3. Справочники

- **Категории:** `GET/POST/PATCH/DELETE /api/categories`.
- **Валюты и курсы:** `GET /api/exchange-rates?currency=UZS&from=...&to=...`, `POST /api/exchange-rates` (ручной ввод), `POST /api/exchange-rates/refresh` (форсировать pull из ЦБ РУз).
- **Шаблоны уведомлений:** `GET/POST/PATCH /api/notification-templates`.

### 6.4. Отправители и перевозчики

- CRUD: `/api/senders`, `/api/carriers`.
- Поиск: query-параметр `?q=` (full-text по индексу).
- На карточке: история (`GET /api/senders/:id/lots`, `GET /api/carriers/:id/shipments`), баланс (`GET /api/senders/:id/balance`), быстрый платёж (`POST /api/transactions`).
- Привязка Telegram: `GET /api/integrations/telegram/link?type=sender&id=...` возвращает deep-link `https://t.me/<bot>?start=<token>`. После `/start` бот сохраняет `telegramChatId` в коллекцию.

### 6.5. Приёмка на склад

- `POST /api/lots` (multipart/form-data): поля + до 10 фото.
  - Backend: multer принимает в память, sharp ресайзит до max 1600 px и JPEG q=80, загружает в S3, в документе сохраняет только `storageKey`.
- `GET /api/lots?senderId=&categoryId=&from=&to=&status=&page=&limit=`.
- `PATCH /api/lots/:id` — только заметки и фото (количество менять нельзя если есть отгрузки).
- `DELETE /api/lots/:id` — только если `qtyIn == qtyAvailable` и нет отгрузок; иначе 409.
- `GET /api/lots/:id/photos/:photoId` — отдаёт подписанный URL S3 (TTL 1 час).
- `POST /api/lots/:id/receipt-pdf` — генерирует PDF, кладёт в `attachments`, возвращает URL.

### 6.6. Склад (остатки)

- `GET /api/stock/by-category` — агрегация.
- `GET /api/stock/by-sender` — агрегация.
- `GET /api/stock/lots?available=true` — детально.

### 6.7. Создание отправки

- `POST /api/shipments`:
  ```json
  {
    "carrierId": "...",
    "recipient": { "name": "...", "phone": "...", "addressTr": "..." },
    "shipmentDate": "2026-05-17",
    "carrierFee": { "amount": 5000, "currency": "USD" },
    "items": [{ "lotId": "...", "qty": 5, "senderCharge": { "amount": 2000, "currency": "USD" } }],
    "notes": ""
  }
  ```
- Backend в **транзакции**:
  1. Блокирует `inboundLots` (через `findOneAndUpdate` с проверкой `qtyAvailable >= qty`); если не хватает — 409 с указанием конкретного lot.
  2. Декрементит `qtyAvailable`, пересчитывает `status` lot'а.
  3. Получает `shortCode` через `counters`.
  4. Создаёт `shipment` со статусом `bekliyor`.
  5. Создаёт `transactions`: один `carrier_charge` и по одному `sender_charge` на каждую позицию (если задана).
  6. Эмитит событие в socket.io room `org:{orgId}` (для realtime-обновления у других пользователей).
- `PATCH /api/shipments/:id/status` — смена статуса с записью в `statusHistory`, при `iptal` — реверс через транзакцию.
- `POST /api/shipments/:id/waybill-pdf` — накладная PDF.

### 6.8. Отслеживание

- `GET /api/shipments?status=&carrierId=&senderId=&from=&to=&q=&page=&limit=`.
- `GET /api/shipments/:id` — детально.
- **Публично** (без auth): `GET /api/public/track/:token` — отдаёт безопасную выборку (без сумм, телефонов целиком — последние 4 цифры).

### 6.9. Финансы

- `GET /api/balances/carriers?currency=USD` — список балансов.
- `GET /api/balances/senders?currency=USD`.
- `GET /api/transactions?counterpartyType=carrier&counterpartyId=&from=&to=&kind=`.
- `POST /api/transactions` — регистрация платежа или ручной adjustment.
- `POST /api/transactions/:id/receipt-pdf` — расписка.

**Конвертация валют:** сервис `currencyService.convert(amount, from, to, date)` — берёт ближайший по дате курс из `exchangeRates`, кэширует в LRU.

### 6.10. Уведомления

- Сервис `notificationService.send({ templateKey, recipient, vars })`.
- Очередь: коллекция `notificationLog` со статусом `queued` обрабатывается воркером (либо отдельный процесс с `node-cron` каждые 30 сек, либо in-process с BullMQ + Redis для надёжности).
- Стратегия: если у получателя есть `telegramChatId` → Telegram, иначе SMS.
- Eskiz.uz SDK: получение токена раз в сутки (cron), отправка через `POST /api/message/sms/send`.
- Retry: 3 попытки с задержкой 30 / 120 / 600 секунд.
- Триггеры — на смене статусов и регистрации платежей (вызов из соответствующих контроллеров).

**Telegram-бот:** отдельный long-poll или webhook-обработчик в том же Express (либо отдельный процесс).

- `/start <token>` — привязка чата к карточке.
- Inline-кнопка «Trakla» под уведомлением → открывает публичную ссылку.

### 6.11. PDF-документы

Реализация — `@react-pdf/renderer` в общем пакете `packages/pdf-templates`:

- `<ReceiptDocument lot={...} />` — приёмная расписка.
- `<WaybillDocument shipment={...} />` — накладная.
- `<PaymentReceiptDocument tx={...} />` — расписка об оплате.

Рендеринг:

- На клиенте — мгновенный preview и скачивание (`<PDFViewer>` / `<BlobProvider>`).
- На сервере — через `@react-pdf/renderer`'s `renderToStream` в Edge case (когда нужен URL для отправки в Telegram). Стрим заливается в S3.

QR-коды через `qrcode` npm-пакет, генерируются как dataURL и встраиваются в PDF.

### 6.12. Отчёты

- `GET /api/reports/dashboard?currency=USD` — KPI + временные ряды.
- `GET /api/reports/carriers?from=&to=&currency=` — таблица.
- `GET /api/reports/senders?...`.
- `GET /api/reports/categories?...`.
- `GET /api/reports/finance?...`.
- `GET /api/reports/:type/export?format=csv|xlsx` — потоковая выдача файла (через `exceljs` streaming).

### 6.13. Поиск

- `GET /api/search?q=` — multi-collection search через `$text` индексы по `senders`, `carriers`, `shipments` (получатель), агрегация результатов с типизацией.

### 6.14. Realtime (Socket.IO)

- Авторизация сокета через JWT в `handshake.auth.token`.
- Каждое подключение присоединяется к комнате `org:{orgId}` и (для admin) к `org:{orgId}:admin`.
- События:
  - `shipment:created` / `shipment:status_changed`
  - `lot:created`
  - `transaction:created`
  - `notification:sent`
- Фронтенд инвалидирует соответствующие react-query кэши при получении событий.

### 6.15. Аудит

- Глобальная мидлварь `auditMiddleware` логирует все mutation-методы (POST/PATCH/PUT/DELETE) с дифом.
- UI: `GET /api/audit-log?entityType=&entityId=&userId=&from=&to=`.

### 6.16. Экспорт / резервная копия

- `POST /api/admin/export` (admin only) — формирует ZIP в фоне (BullMQ job), по готовности отправляет ссылку через notification.
- В архиве: JSON-дампы коллекций + папка `attachments/` (вытягиваются из S3 по ключам).
- Дополнительно — ежедневный snapshot MongoDB Atlas (платная фича) или `mongodump` через cron в S3 для self-hosted.

### 6.17. PWA / оффлайн

- Service Worker (Workbox через `vite-plugin-pwa`):
  - Precache shell приложения.
  - Runtime caching: `staleWhileRevalidate` для GET-запросов (с тегом инвалидации).
- Оффлайн-мутации:
  - TanStack Query mutation cache + кастомный персист в IndexedDB.
  - При восстановлении сети — последовательная отправка очереди; ошибки 409 (нехватка остатка) показываются пользователю с ручным разрешением конфликта.
- Индикация: badge в шапке «N изменений ожидают синхронизации».

---

## 7. UI / UX требования

### 7.1. Адаптив

- **Mobile-first** (приоритет 360–480 px), обязательная поддержка планшета (768 px) и десктопа (≥ 1024 px) с двухколоночными списками и боковой навигацией.
- Touch-target ≥ 44 × 44 px.

### 7.2. Дизайн-система

- **shadcn/ui** + Tailwind, тема настраиваемая (по умолчанию синяя: primary `#1E40AF`, accent `#2563EB`).
- Цвета статусов:
  - `bekliyor` — `#6B7280` (серый)
  - `yolda` — `#F59E0B`
  - `teslim` — `#10B981`
  - `kayip` — `#EF4444`
  - `borclu` — `#8B5CF6`
  - `iptal` — `#9CA3AF`
- Тёмная тема обязательна.

### 7.3. Локализация

- Основной: турецкий. Резерв: русский, узбекский (латиница).
- `i18next` с lazy-loading локалей.

### 7.4. Доступность

- WCAG 2.1 AA по контрасту, семантический HTML, ARIA-атрибуты от Radix.
- Полная работоспособность с клавиатуры на десктопе.

### 7.5. Микровзаимодействия

- Skeleton-loader.
- Toast-нотификации.
- Подтверждение опасных действий (модалка с явным вводом подтверждения).
- Optimistic updates через TanStack Query mutation.

---

## 8. Нефункциональные требования

| Параметр                                       | Значение                                                      |
| ---------------------------------------------- | ------------------------------------------------------------- |
| First Contentful Paint (4G)                    | ≤ 2 с                                                         |
| Initial JS-бандл                               | ≤ 250 КБ gzipped                                              |
| API latency P95                                | ≤ 400 мс                                                      |
| Lighthouse Performance / A11y / Best Practices | ≥ 90                                                          |
| Доступность (SLA)                              | 99.5 %                                                        |
| RPO / RTO бэкапов                              | 24 ч / 4 ч                                                    |
| Поддерживаемые браузеры                        | Chrome / Safari / Firefox последние 2 версии; iOS Safari ≥ 15 |
| Максимальный размер загружаемого фото          | 10 МБ до сжатия                                               |
| Максимум фото на партию                        | 10                                                            |

---

## 9. Безопасность

- **JWT:** access короткий (15 мин), refresh в httpOnly + Secure + SameSite=Lax cookie, ротация при использовании.
- **Пароли:** bcrypt cost 12, минимум 10 символов, проверка по haveibeenpwned-словарю (top 1000 паролей).
- **Авторизация:** middleware `requireRole`; в каждом контроллере — фильтр по `orgId = req.user.orgId`.
- **Валидация ввода:** все запросы проходят через zod-схемы (общие со фронтом). Отсутствие/невалидность → 400.
- **Защита от NoSQL injection:** `express-mongo-sanitize` (удаляет `$` и `.` из user input), запрет передачи объектов вместо строк в `_id`.
- **HTTP-защита:** `helmet` (CSP, HSTS, X-Frame-Options), `cors` с whitelist, `hpp` против HTTP Parameter Pollution.
- **Rate limiting:** `express-rate-limit` глобально (100 req/мин на IP), отдельно жёстче на `/api/auth/*` (10 req/мин) и `/api/public/track/*` (20 req/мин).
- **CSRF:** для cookie-based refresh — double-submit cookie pattern.
- **Загрузка файлов:** проверка MIME через `file-type` (не доверяем content-type заголовку), белый список (jpeg/png/webp/pdf), max 10 МБ, scanned через `clamav` для self-hosted (опционально).
- **S3:** bucket приватный, доступ через presigned URL (TTL 1 час).
- **Двухфакторка:** TOTP (через `speakeasy`) для admin.
- **Маскирование PII:** в `auditLog.diff` телефоны хранятся как `***1234`.
- **Логирование:** структурированные JSON-логи, без секретов и паролей. Маскирование `Authorization` и `Cookie` хедеров.
- **Sentry:** включён на обоих сторонах с фильтром PII.

---

## 10. Развёртывание и DevOps

### 10.1. Окружения

- `local` — docker-compose: mongo (replica set с 1 нодой), minio, api, web.
- `dev` — отдельный MongoDB Atlas free cluster, Railway/Render staging.
- `prod` — Atlas M10+, Railway/Render prod или VPS под Nginx + PM2.

### 10.2. Переменные окружения

Файлы `.env` (не коммитятся), пример в `.env.example`. В проде — загрузка через нативный флаг Node 24 `node --env-file=.env.production dist/server.js` (без `dotenv`). В dev — `node --env-file=.env --watch src/server.ts` либо `tsx --watch`. Валидация всех переменных при старте через zod-схему — приложение падает с понятной ошибкой, если что-то отсутствует.

**API:**

```
NODE_ENV=production
PORT=4000
MONGODB_URI=mongodb+srv://...
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
S3_ENDPOINT=...
S3_BUCKET=...
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
SMTP_HOST=...
SMTP_USER=...
SMTP_PASS=...
ESKIZ_EMAIL=...
ESKIZ_PASSWORD=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TELEGRAM_BOT_TOKEN=...
SENTRY_DSN=...
CORS_ORIGIN=https://app.example.com
```

**Web:**

```
VITE_API_URL=https://api.example.com
VITE_SOCKET_URL=wss://api.example.com
VITE_SENTRY_DSN=...
VITE_PUBLIC_TRACK_URL=https://app.example.com/track
```

### 10.3. CI/CD (GitHub Actions)

Pipeline:

1. **PR:** install (`pnpm i --frozen-lockfile`) → lint → typecheck → unit-тесты → build.
2. **Merge в `main`:**
   - **api:** docker build → push в registry → deploy на Railway/Render (или `ssh + pm2 reload` для VPS).
   - **web:** Vite build → deploy на Vercel.
3. **Миграции БД** — отдельный шаг перед api-деплоем: `pnpm --filter api migrate:up` (запускает скрипты из `apps/api/src/migrations/`).

### 10.4. Миграции MongoDB

Хотя MongoDB schemaless, используем **migrate-mongo** для:

- создания индексов;
- сидирования справочников (категории, валюты, шаблоны уведомлений);
- бэкфилла новых полей (`updateMany`);
- переходов формата (split / merge коллекций).

Каждая миграция имеет `up` и `down`. История в коллекции `_migrations`.

### 10.5. Мониторинг

- **Логи:** stdout JSON → агрегатор (Logtail / Better Stack / Loki).
- **Метрики:** Prometheus endpoint `/metrics` на api, дашборд в Grafana (опционально).
- **Uptime:** UptimeRobot пингует `/api/health` каждые 5 мин.
- **Ошибки:** Sentry.

---

## 11. План этапов разработки (roadmap)

**Этап 0. Каркас (1 неделя)**

- Монорепо (pnpm workspaces), TypeScript 5.6 strict, ESLint 9 flat config + `eslint-plugin-react-compiler`, Prettier, общий пакет `shared-types` (zod-схемы).
- Express 5 boilerplate на Node 24.15: error handler (нативная поддержка async), request validation через zod, structured logging (pino), health endpoint, `--env-file` + zod-валидация env.
- React 19.2 boilerplate: Vite 6 + React Compiler плагин, React Router 7, базовый layout, темизация, axios-клиент с refresh-interceptor, ref как prop (без `forwardRef`).
- docker-compose для локалки: mongo (replica set, 1 нода), minio, api с `node --env-file=.env --watch`, web.
- CI настроен (Node 24 в actions matrix).

**Этап 1. Аутентификация и пользователи (1 неделя)**

- Модель `users`, JWT (access + refresh), bcrypt, email-отправка через nodemailer.
- Middleware `requireAuth`, `requireRole`.
- UI: страница логина, восстановления, профиля, управления пользователями (admin).

**Этап 2. Справочники (1 неделя)**

- Категории, senders, carriers — CRUD.
- Валюты, курсы, cron-скрипт обновления из cbu.uz.
- UI таблиц, форм, поиска.

**Этап 3. Склад (2 недели)**

- `inboundLots` с фото (multer + sharp + S3).
- Транзакционная логика `qtyAvailable`.
- Экраны: приёмка, остатки (3 представления), детализация партии.
- PDF приёмной расписки.

**Этап 4. Отправки (2 недели)**

- `shipments` с встроенными items и statusHistory, counters для shortCode.
- API + UI мастера создания отправки.
- Смена статусов + история, отмена с реверсом.
- Накладная PDF.
- Socket.IO для realtime-обновления списка.

**Этап 5. Финансы (1.5 недели)**

- `transactions`, мультивалютность, конвертация.
- Балансы перевозчиков и отправителей (aggregation).
- UI: ленты транзакций, регистрация платежа, расписка PDF.
- Финансовый отчёт.

**Этап 6. Уведомления (1 неделя)**

- Telegram-бот, привязка чатов.
- Eskiz.uz SMS-интеграция.
- Очередь + retry + шаблоны.
- UI редактирования шаблонов.

**Этап 7. Отчёты и поиск (1 неделя)**

- Дашборд с Recharts.
- Все табличные отчёты + экспорт CSV/XLSX.
- Глобальный поиск.

**Этап 8. PWA, оффлайн, полировка (1 неделя)**

- Service Worker, оффлайн-очередь.
- i18n (tr/ru/uz).
- Audit-log UI.
- Тёмная тема.

**Этап 9. QA, безопасность, нагрузочные (1 неделя)**

- E2E Playwright на 5 ключевых сценариев.
- Прогон через OWASP ZAP, проверка rate limiting и SQL/NoSQL injection.
- Smoke + load test (`k6` или Artillery) — 50 RPS на /api/shipments.
- Документация пользователя.

**Этап 10. Пилот (1 неделя)**

- Запуск параллельно со старым процессом.
- Сбор фидбэка, мелкие правки.

**Итого:** ~13 недель для одного fullstack-разработчика + 1 неделя QA, или ~8–9 недель командой из 2 fullstack + 1 QA.

---

## 12. Acceptance criteria

Система принимается готовой к продакшну, если:

1. Авторизованный operator может за **≤ 90 секунд** оформить приёмку партии с 3 фото и распечатать расписку.
2. Авторизованный operator может за **≤ 2 минуты** создать отправку из 3 разных партий двум разным отправителям одному перевозчику с автоматическим начислением долга и распечатать накладную.
3. При смене статуса `yolda → teslim` отправителю **в течение 30 секунд** уходит сообщение (Telegram приоритетнее SMS), факт логируется в `notificationLog`.
4. `inboundLots.qtyAvailable` **никогда** не становится отрицательным — гарантируется транзакцией с `$inc` и условием `qtyAvailable >= qty` в `findOneAndUpdate`. Тест: 100 параллельных запросов на отгрузку одного и того же lot — ровно `qtyIn / qty` успехов, остальные получают 409.
5. Финансовый отчёт за произвольный период конвертирует UZS/TRY в USD по курсам, действовавшим на даты транзакций (snapshot в `exchangeRateToUsd`).
6. `/api/public/track/:token` отдаёт корректный статус без раскрытия финансов и полного телефона.
7. Lighthouse Performance ≥ 90 на мобильном профиле.
8. `viewer` не может выполнить ни одной mutation (e2e-тест: каждая mutation возвращает 403).
9. После 10 минут offline-режима с тремя созданными отправками — все три синхронизируются после восстановления связи, состояние склада консистентно. При конфликте остатков пользователь видит понятное сообщение.
10. Полный экспорт данных (ZIP) формируется ≤ 60 секунд для базы из 10 000 партий и 30 000 отправок, открывается локально.
11. `npm audit --production` и `pnpm audit` не показывают уязвимостей уровня **high** или выше.
12. Все ключевые сценарии покрыты e2e-тестами (минимум: логин, приёмка, отправка, смена статуса, платёж, отчёт).

---

## Приложение A. Карта вкладок мобильного интерфейса

| #   | Вкладка                        | Содержание                                 |
| --- | ------------------------------ | ------------------------------------------ |
| 1   | **Ana Sayfa** (Главная)        | KPI + остатки сводно + долги сводно        |
| 2   | **Depo** (Склад)               | Партии, остатки, приёмка                   |
| 3   | **Göndericiler** (Отправители) | Карточки клиентов с балансами              |
| 4   | **Kargocular** (Перевозчики)   | Карточки с балансами                       |
| 5   | **Çıkış** (Отгрузка)           | Мастер создания отправки                   |
| 6   | **Takip** (Отслеживание)       | Активные/завершённые отправки              |
| 7   | **Finans** (Финансы)           | Транзакции, платежи                        |
| 8   | **Raporlar** (Отчёты)          | Дашборды и экспорт                         |
| 9   | **Ayarlar** (Настройки)        | Справочники, пользователи, шаблоны (admin) |

Нижняя навигация на мобильном — 5 ключевых (Главная / Склад / Отгрузка / Отслеживание / Меню). Остальное под кнопкой «Меню».

---

## Приложение B. Что НЕ переносим из прототипа

При переписывании старый код используется только как референс UX. Не переносим:

- Хранение в `window.storage` (заменяем на REST API + MongoDB).
- Расчёт остатка вычитанием по всем отправкам без учёта `iptal` (исправлено: только активные, через `qtyAvailable`).
- Inline-стили (Tailwind + shadcn).
- Отсутствие типов (TypeScript + zod).
- Безусловный `parseInt` без `||` (валидация zod).
- Сломанные операторы `||` в коде (в чате стояли пробелы вместо `||`).
- Отсутствие audit-log и истории смен статуса.
- Отсутствие многопользовательской работы и ролей.

---

## Приложение C. REST API — соглашения

- Базовый префикс: `/api/v1`.
- JSON во всех запросах/ответах. UTF-8.
- Стандартные коды:
  - `200` OK, `201` Created, `204` No Content.
  - `400` валидация (тело: `{ error, fields: { fieldName: 'message' } }`).
  - `401` неавторизован, `403` нет прав, `404` не найдено, `409` конфликт (например, остаток), `429` rate-limit.
  - `500` непредвиденное (тело: `{ error: 'internal', requestId }`; полная информация — в Sentry/логах).
- Пагинация: `?page=1&limit=20`, ответ `{ data: [], pagination: { page, limit, total, hasMore } }`.
- Сортировка: `?sort=field` / `?sort=-field`.
- Фильтры: явные query-параметры, не `?filter[key]=value`.
- Все timestamps в ответе — ISO 8601 UTC.
- Все суммы — `{ amount: 1234, currency: 'USD' }`, где `amount` в минорных единицах (центы).
- Идемпотентность мутаций: заголовок `Idempotency-Key` поддерживается для `POST /api/transactions` и `POST /api/shipments`.

---

## Приложение D. Покрытие тестами (минимум)

| Слой                | Инструмент                     | Что покрываем                                                                                                            |
| ------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Backend unit        | Vitest + mongodb-memory-server | Сервисы: создание отправки (транзакция), конвертация валют, расчёт балансов, рендеринг шаблонов уведомлений              |
| Backend integration | Vitest + supertest             | Все эндпоинты — позитивные + 401/403/400/409 кейсы                                                                       |
| Frontend unit       | Vitest + RTL                   | Утилиты, кастомные хуки, валидаторы форм                                                                                 |
| E2E                 | Playwright                     | Логин → приёмка с фото → создание отправки → смена статуса → проверка уведомления (мок) → отчёт. Прогон в headless в CI. |
| Нагрузка            | k6 / Artillery                 | 50 RPS на `/api/shipments` (GET), 10 RPS на `POST /api/shipments`                                                        |

Минимальное покрытие кода: **70 %** на бэкенде (services + controllers), **50 %** на фронтенде.

---

**Документ закрыт.** Готов к декомпозиции на задачи в трекере и старту Этапа 0.
