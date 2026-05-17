import { Types } from "mongoose";
import type {
  NotificationChannel,
  NotificationLanguage,
  NotificationTemplateKey,
} from "@sadiyakargo/shared";
import { logger } from "../../lib/logger.js";
import { env } from "../../config/env.js";
import { paginate, tenantFilter } from "../../lib/repository.js";
import { sendTelegram } from "./adapters.js";
import { getQueue } from "./queue.js";
import { NotificationTemplate } from "./template.model.js";
import { NotificationLog } from "./log.model.js";

const MAX_ATTEMPTS = 3;
const BACKOFF_SEC = [30, 120, 600];

interface EnqueueInput {
  orgId: string;
  templateKey: NotificationTemplateKey;
  channel?: NotificationChannel;
  language?: NotificationLanguage;
  recipient: {
    type: "sender" | "carrier" | "recipient";
    id?: string | null;
    phone?: string | null;
    chatId?: number | null;
  };
  vars?: Record<string, unknown>;
}

function renderBody(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
    vars[key] !== undefined ? String(vars[key]) : `{{${key}}}`
  );
}

/**
 * Persist a queued notification, then either enqueue to BullMQ (if Redis is
 * configured) or process it synchronously (dev / tests). Returns the log id.
 */
export async function enqueue(input: EnqueueInput): Promise<string | null> {
  const channel = input.channel ?? "telegram";
  const language = input.language ?? "tr";
  const template = await NotificationTemplate.findOne(
    tenantFilter(input.orgId, {
      key: input.templateKey,
      channel,
      language,
      active: true,
    })
  );
  if (!template) {
    logger.warn({ key: input.templateKey, channel, language }, "no_active_template");
    return null;
  }

  // Skip if we have no way to deliver (no chatId for telegram).
  if (channel === "telegram" && !input.recipient.chatId) {
    logger.info(
      { recipient: input.recipient, key: input.templateKey },
      "telegram_skipped_no_chat_id"
    );
    return null;
  }

  const rendered = renderBody(template.body, input.vars || {});

  const log = await NotificationLog.create({
    orgId: new Types.ObjectId(input.orgId),
    channel,
    recipientType: input.recipient.type,
    recipientRef: {
      id: input.recipient.id ? new Types.ObjectId(input.recipient.id) : null,
      phone: input.recipient.phone ?? null,
      chatId: input.recipient.chatId ?? null,
    },
    templateKey: input.templateKey,
    payload: input.vars || {},
    renderedText: rendered,
    status: "queued",
    attempts: 0,
  });

  const queue = getQueue();
  if (queue) {
    await queue.add(
      "send",
      { logId: log._id.toString() },
      { attempts: MAX_ATTEMPTS, backoff: { type: "exponential", delay: BACKOFF_SEC[0] * 1000 } }
    );
  } else {
    // No Redis — process synchronously (dev / tests / first run).
    await processOne(log._id.toString());
  }
  return log._id.toString();
}

/** Worker handler: load log, dispatch via adapter, mark sent/failed. */
export async function processOne(logId: string): Promise<void> {
  const log = await NotificationLog.findById(logId);
  if (!log) return;
  log.attempts += 1;
  try {
    if (log.channel === "telegram" && log.recipientRef.chatId) {
      const res = await sendTelegram({
        chatId: log.recipientRef.chatId,
        text: log.renderedText,
      });
      log.providerResponse = res as unknown as Record<string, unknown>;
    } else {
      // SMS not enabled in this stage.
      throw new Error(`channel ${log.channel} not supported`);
    }
    log.status = "sent";
    log.sentAt = new Date();
    log.errorMessage = null;
  } catch (err) {
    log.status = log.attempts >= MAX_ATTEMPTS ? "failed" : "queued";
    log.errorMessage = err instanceof Error ? err.message : String(err);
    logger.error({ err, logId, attempts: log.attempts }, "notification_send_failed");
    if (log.status === "queued") {
      const queue = getQueue();
      if (queue) {
        const delay = BACKOFF_SEC[Math.min(log.attempts, BACKOFF_SEC.length - 1)] * 1000;
        await queue.add("send", { logId }, { delay, attempts: 1 });
      }
    }
  }
  await log.save();
}

/** Tests/operators may want to force-process the in-memory queue. */
export async function flushPending(): Promise<void> {
  if (env.NODE_ENV !== "test") return;
  const pending = await NotificationLog.find({ status: "queued" });
  for (const log of pending) {
    await processOne(log._id.toString());
  }
}

interface ListLogQuery {
  page?: number;
  limit?: number;
  status?: "queued" | "sent" | "failed";
  templateKey?: NotificationTemplateKey;
}

export async function listLogs(orgId: string, query: ListLogQuery) {
  const filter = tenantFilter(orgId);
  if (query.status) Object.assign(filter, { status: query.status });
  if (query.templateKey) Object.assign(filter, { templateKey: query.templateKey });
  return paginate(NotificationLog, filter, query, (d) => d.toClient(), { createdAt: -1 });
}
