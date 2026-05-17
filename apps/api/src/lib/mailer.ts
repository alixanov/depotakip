import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (transporter) return transporter;
  if (!env.SMTP_HOST) return null;
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER && env.SMTP_PASS ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  return transporter;
}

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Send an email or — when SMTP isn't configured — log it (dev fallback). */
export async function sendMail(msg: MailMessage): Promise<void> {
  const t = getTransporter();
  if (!t) {
    logger.warn({ mail: msg }, "smtp_not_configured_logging_mail");
    return;
  }
  await t.sendMail({
    from: env.SMTP_FROM || `Depo Yönetim <noreply@${env.COOKIE_DOMAIN || "localhost"}>`,
    ...msg,
  });
}
