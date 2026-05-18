import { createServer } from "node:http";
import { Server as IoServer } from "socket.io";
import { env } from "./config/env.js";
import { createApp } from "./app.js";
import { connect, disconnect } from "./config/db.js";
import { logger } from "./lib/logger.js";
import { setIoServer } from "./lib/realtime.js";
import { verifyAccessToken } from "./lib/jwt.js";
import { startWorker, stopWorker } from "./modules/notifications/queue.js";
import { processOne } from "./modules/notifications/notifications.service.js";

async function start(): Promise<void> {
  await connect();
  const app = createApp();

  const httpServer = createServer(app);
  const io = new IoServer(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN.split(",").map((s) => s.trim()),
      credentials: true,
    },
  });

  // JWT auth on the socket handshake. Once verified, join the per-org room.
  // The admin-only room (`audit:read` perm) is for sensitive realtime events
  // like new audit-log entries that operators shouldn't see live.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("token required"));
    try {
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      socket.data.orgId = payload.orgId;
      socket.data.permissions = payload.permissions;
      socket.join(`org:${payload.orgId}`);
      if (payload.permissions?.includes("audit:read")) {
        socket.join(`org:${payload.orgId}:admin`);
      }
      next();
    } catch {
      next(new Error("invalid token"));
    }
  });

  setIoServer(io);

  // BullMQ воркер для notifications. Возвращает null, если REDIS_URL пуст —
  // тогда enqueue() остаётся на синхронном in-process fallback (dev/test).
  // С Redis: воркер живёт в том же процессе, что и API; уведомления
  // обрабатываются через processOne с manual-retry/backoff внутри.
  const notifWorker = startWorker(
    async (data) => {
      const { logId } = data as { logId: string };
      await processOne(logId);
    },
    { concurrency: env.WORKER_CONCURRENCY }
  );
  if (notifWorker) {
    logger.info({ concurrency: env.WORKER_CONCURRENCY }, "notification worker started (BullMQ)");
  }

  httpServer.listen(env.PORT, () => {
    logger.info({ port: env.PORT, prefix: env.API_PREFIX }, "API listening");
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "shutting_down");
    io.close();
    httpServer.close(async () => {
      // Порядок важен: сначала останавливаем воркер (дав текущим jobs
      // завершиться внутри stopWorker → worker.close), потом закрываем БД.
      // Иначе in-flight processOne может попасть в Mongoose disconnect.
      try {
        await stopWorker();
      } catch (err) {
        logger.error({ err }, "worker_stop_failed");
      }
      try {
        await disconnect();
      } catch (err) {
        logger.error({ err }, "disconnect_failed");
      } finally {
        process.exit(0);
      }
    });
    setTimeout(() => {
      logger.error("forced shutdown after timeout");
      process.exit(1);
    }, 10000).unref();
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

start().catch((err) => {
  logger.fatal({ err }, "failed_to_start");
  process.exit(1);
});
