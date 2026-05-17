import { Telegraf } from "telegraf";
import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";

export interface TelegramSendArgs {
  chatId: number;
  text: string;
}

let bot: Telegraf | null = null;

export function getTelegramBot(): Telegraf | null {
  if (bot) return bot;
  if (!env.TELEGRAM_BOT_TOKEN) return null;
  bot = new Telegraf(env.TELEGRAM_BOT_TOKEN);
  return bot;
}

/** Send a text message via Telegram, or log when no token is configured. */
export async function sendTelegram(args: TelegramSendArgs): Promise<{ ok: boolean }> {
  const instance = getTelegramBot();
  if (!instance) {
    logger.warn({ telegram: args }, "telegram_no_token_logged");
    return { ok: true };
  }
  await instance.telegram.sendMessage(args.chatId, args.text);
  return { ok: true };
}
