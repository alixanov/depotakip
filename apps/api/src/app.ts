import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import { randomUUID } from "node:crypto";

import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { errorHandler } from "./middleware/error.js";
import { notFoundHandler } from "./middleware/notFound.js";
import { sanitize } from "./middleware/sanitize.js";
import { originCheck } from "./middleware/originCheck.js";
import { audit } from "./middleware/audit.js";
import healthRoutes from "./modules/health/health.routes.js";
import authRoutes from "./modules/auth/auth.routes.js";
import usersRoutes from "./modules/users/users.routes.js";
import categoriesRoutes from "./modules/categories/categories.routes.js";
import sendersRoutes from "./modules/senders/senders.routes.js";
import carriersRoutes from "./modules/carriers/carriers.routes.js";
import exchangeRatesRoutes from "./modules/exchangeRates/exchangeRates.routes.js";
import lotsRoutes from "./modules/lots/lots.routes.js";
import transactionsRoutes from "./modules/transactions/transactions.routes.js";
import notificationsRoutes from "./modules/notifications/notifications.routes.js";
import reportsRoutes from "./modules/reports/reports.routes.js";
import searchRoutes from "./modules/search/search.routes.js";
import auditRoutes from "./modules/audit/audit.routes.js";
import shipmentsRoutes, {
  publicRouter as publicTrackRouter,
} from "./modules/shipments/shipments.routes.js";

declare module "express-serve-static-core" {
  interface Request {
    id: string;
  }
}

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  // Request id + structured logging
  app.use((req, _res, next) => {
    req.id = (req.headers["x-request-id"] as string) || randomUUID();
    next();
  });
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as express.Request).id,
      autoLogging: { ignore: (req) => req.url === `${env.API_PREFIX}/health` },
    })
  );

  // Security
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(",").map((s) => s.trim()),
      credentials: true,
    })
  );
  // NB: `hpp` and `express-mongo-sanitize` both mutate `req.query`, which is
  // a read-only getter in Express 5 — we use `sanitize` for body and rely on
  // zod query schemas (`.strict()`) to reject duplicate/unexpected params.
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  app.use(sanitize);
  app.use(originCheck);
  if (env.NODE_ENV !== "test") app.use(audit);

  // Global rate limit
  app.use(
    rateLimit({
      windowMs: env.RATE_LIMIT_GLOBAL_WINDOW_MS,
      limit: env.RATE_LIMIT_GLOBAL_MAX,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      skip: () => env.NODE_ENV === "test",
    })
  );

  // Routes
  app.use(`${env.API_PREFIX}/health`, healthRoutes);
  app.use(`${env.API_PREFIX}/auth`, authRoutes);
  app.use(`${env.API_PREFIX}/users`, usersRoutes);
  app.use(`${env.API_PREFIX}/categories`, categoriesRoutes);
  app.use(`${env.API_PREFIX}/senders`, sendersRoutes);
  app.use(`${env.API_PREFIX}/carriers`, carriersRoutes);
  app.use(`${env.API_PREFIX}/exchange-rates`, exchangeRatesRoutes);
  app.use(`${env.API_PREFIX}/lots`, lotsRoutes);
  app.use(`${env.API_PREFIX}/shipments`, shipmentsRoutes);
  app.use(`${env.API_PREFIX}/transactions`, transactionsRoutes);
  app.use(`${env.API_PREFIX}/notifications`, notificationsRoutes);
  app.use(`${env.API_PREFIX}/reports`, reportsRoutes);
  app.use(`${env.API_PREFIX}/search`, searchRoutes);
  app.use(`${env.API_PREFIX}/audit-log`, auditRoutes);
  app.use(`${env.API_PREFIX}/public/track`, publicTrackRouter);

  // 404 + error
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
