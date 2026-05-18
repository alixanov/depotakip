import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  API_PREFIX: z.string().default("/api/v1"),

  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),

  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 chars"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 chars"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("30d"),

  CORS_ORIGIN: z.string().default("http://localhost:3000"),

  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: z
    .string()
    .transform((v) => v === "true")
    .default("false"),

  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_AUTH_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60 * 1000),
  RATE_LIMIT_GLOBAL_MAX: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_GLOBAL_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 1000),
  RATE_LIMIT_PUBLIC_TRACK_MAX: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_PUBLIC_TRACK_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 1000),

  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),

  // SMTP (optional — when unset, mailer logs to pino instead of sending)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  // Public web origin — used in password-reset email links
  WEB_BASE_URL: z.string().url().default("http://localhost:3000"),

  // Redis for BullMQ notifications. Leave REDIS_URL empty in dev/tests for
  // synchronous in-process processing (no queue persistence).
  REDIS_URL: z.string().optional(),

  // Telegram bot — leave token empty to log payloads instead of sending.
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_BOT_USERNAME: z.string().optional(),

  // Optional initial admin (idempotent seed)
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(10).optional(),
  ADMIN_FULL_NAME: z.string().optional(),

  DEFAULT_ORG_ID: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "DEFAULT_ORG_ID must be a 24-hex ObjectId")
    .default("000000000000000000000001"),

  // S3-compatible object storage for lot photos (MinIO locally, R2/S3 in prod).
  // Defaults match docker-compose minio + the bucket created by minio-init.
  S3_ENDPOINT: z.string().url().default("http://localhost:9000"),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().default("sadiyakargo-photos"),
  S3_ACCESS_KEY: z.string().default("minio"),
  S3_SECRET_KEY: z.string().default("minio12345"),
  // MinIO and most S3-compatible providers (R2, Wasabi) require path-style URLs.
  // Set to "false" only when targeting real AWS S3 (virtual-hosted-style).
  S3_FORCE_PATH_STYLE: z
    .string()
    .transform((v) => v !== "false")
    .default("true"),

  // Lot photo limits — TZ §15 caps at 10 photos / 10 MB per lot.
  LOT_PHOTO_MAX_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(10 * 1024 * 1024),
  LOT_PHOTO_MAX_COUNT: z.coerce.number().int().positive().default(10),
  // Presigned GET URL TTL — TZ §9 mandates 1 hour.
  LOT_PHOTO_PRESIGNED_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
  console.error(`[env] Invalid environment variables:\n${issues}`);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
