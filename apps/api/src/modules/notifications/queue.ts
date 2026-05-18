/* eslint-disable @typescript-eslint/no-explicit-any */
import { Queue, Worker, type Job } from "bullmq";
import IORedis, { type Redis } from "ioredis";
import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";

const QUEUE_NAME = "notifications";

let connection: Redis | null = null;
let queue: Queue | null = null;
let worker: Worker | null = null;

function getConnection(): Redis | null {
  if (!env.REDIS_URL) return null;
  if (connection) return connection;
  connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
  connection.on("error", (err) => logger.error({ err }, "redis_error"));
  return connection;
}

export function getQueue(): Queue | null {
  if (queue) return queue;
  const conn = getConnection();
  if (!conn) return null;
  queue = new Queue(QUEUE_NAME, { connection: conn });
  return queue;
}

export function startWorker(
  handler: (data: any) => Promise<void>,
  options: { concurrency?: number } = {}
): Worker | null {
  if (worker) return worker;
  const conn = getConnection();
  if (!conn) return null;
  worker = new Worker(QUEUE_NAME, async (job: Job) => handler(job.data), {
    connection: conn,
    autorun: true,
    concurrency: options.concurrency ?? 1,
  });
  worker.on("failed", (job, err) => {
    logger.error({ err, jobId: job?.id }, "notification_job_failed");
  });
  return worker;
}

export async function stopWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
  if (queue) {
    await queue.close();
    queue = null;
  }
  if (connection) {
    await connection.quit();
    connection = null;
  }
}
