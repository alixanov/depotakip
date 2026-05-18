/* eslint-disable @typescript-eslint/no-explicit-any */
import { createElement } from "react";
import type { Request, Response } from "express";
import { Types } from "mongoose";
import { ReceiptDocument, qrDataUrl, renderToStream } from "@sadiyakargo/pdf-templates";
import { notFound, unauthorized } from "../../lib/errors.js";
import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import { pdfLangFromQuery } from "../../lib/pdfLang.js";
import { tenantFilter } from "../../lib/repository.js";
import { InboundLot } from "./lot.model.js";
import { Sender } from "../senders/sender.model.js";

type IdParams = { id: string };

export const receiptPdf = async (req: Request<IdParams>, res: Response): Promise<void> => {
  if (!req.orgId) throw unauthorized();

  const lot = await InboundLot.findOne(
    tenantFilter(req.orgId, { _id: new Types.ObjectId(req.params.id) })
  );
  if (!lot) throw notFound("Parti bulunamadı");

  // Tenant-scope the lookup even though `lot` is already org-checked —
  // matches the project-wide convention and also filters out soft-deleted
  // senders so the receipt doesn't print a stale name.
  const sender = await Sender.findOne(tenantFilter(req.orgId, { _id: lot.senderId }));

  const qr = await qrDataUrl(`${env.WEB_BASE_URL}/depo/lots/${lot._id.toString()}`, 240);

  const doc = createElement(ReceiptDocument, {
    qrDataUrl: qr,
    language: pdfLangFromQuery(req.query.lang),
    lot: {
      id: lot._id.toString(),
      label: lot.label || "",
      receivedAt: lot.receivedAt.toISOString(),
      qtyIn: lot.qtyIn,
      unitPrice: lot.unitPrice ?? null,
      notes: lot.notes,
    },
    sender: {
      fullName: sender?.fullName || "—",
      phone: sender?.phone || "—",
    },
    org: { name: env.ORG_NAME },
  });

  let stream;
  try {
    // @react-pdf typings only accept `Document` elements; ReceiptDocument
    // already wraps one — bypass the narrow signature with a cast.
    stream = await renderToStream(doc as any);
  } catch (err) {
    logger.error(
      { err, lotId: lot._id.toString(), label: lot.label, hasUnitPrice: !!lot.unitPrice },
      "lot_receipt_pdf_render_failed"
    );
    // Duplicate as a plain stderr line so it survives pino-pretty filtering
    // and shows up obviously in the dev terminal.

    console.error("[LOT_PDF_FAIL]", lot._id.toString(), err);
    throw err;
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="receipt-${lot._id.toString()}.pdf"`);
  stream.on("error", (err) => {
    logger.error({ err, lotId: lot._id.toString() }, "lot_receipt_pdf_stream_failed");
    if (!res.headersSent) res.status(500).end();
    else res.destroy(err);
  });
  stream.pipe(res as unknown as NodeJS.WritableStream);
};
