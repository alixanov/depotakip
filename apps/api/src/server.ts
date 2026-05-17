import { createServer } from "node:http";
import { Server as IoServer } from "socket.io";
import { env } from "./config/env.js";
import { createApp } from "./app.js";
import { connect, disconnect } from "./config/db.js";
import { logger } from "./lib/logger.js";
import { setIoServer } from "./lib/realtime.js";
import { verifyAccessToken } from "./lib/jwt.js";

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
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("token required"));
    try {
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      socket.data.orgId = payload.orgId;
      socket.data.role = payload.role;
      socket.join(`org:${payload.orgId}`);
      if (payload.role === "admin") socket.join(`org:${payload.orgId}:admin`);
      next();
    } catch {
      next(new Error("invalid token"));
    }
  });

  setIoServer(io);

  httpServer.listen(env.PORT, () => {
    logger.info({ port: env.PORT, prefix: env.API_PREFIX }, "API listening");
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "shutting_down");
    io.close();
    httpServer.close(async () => {
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
