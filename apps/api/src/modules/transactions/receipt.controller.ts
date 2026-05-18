/* eslint-disable @typescript-eslint/no-explicit-any */
import { createElement } from "react";
import { Types } from "mongoose";
import { PaymentReceiptDocument, qrDataUrl, renderToStream } from "@sadiyakargo/pdf-templates";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { notFound, unauthorized } from "../../lib/errors.js";
import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import { pdfLangFromQuery } from "../../lib/pdfLang.js";
import { tenantFilter } from "../../lib/repository.js";
import { Transaction } from "./transaction.model.js";
import { Carrier } from "../carriers/carrier.model.js";
import { Sender } from "../senders/sender.model.js";

type IdParams = { id: string };

export const paymentReceiptPdf = asyncHandler<IdParams>(async (req, res) => {
  if (!req.orgId) throw unauthorized();
  const tx = await Transaction.findOne(
    tenantFilter(req.orgId, { _id: new Types.ObjectId(req.params.id) })
  );
  if (!tx) throw notFound("Tx bulunamadı");

  const party =
    tx.counterparty.type === "carrier"
      ? await Carrier.findById(tx.counterparty.id)
      : await Sender.findById(tx.counterparty.id);

  const partyName = !party
    ? "—"
    : tx.counterparty.type === "carrier"
      ? `${(party as { firstName: string }).firstName} ${(party as { lastName: string }).lastName}`
      : (party as { fullName: string }).fullName;

  const qr = await qrDataUrl(`${env.WEB_BASE_URL}/finans/transactions/${tx._id.toString()}`, 240);

  // Defensive numeric coercions — legacy / partially-seeded rows may lack
  // amountUsdSnapshot or exchangeRateToUsd, in which case the PDF template's
  // .toFixed() calls would throw and surface as a generic 500 in the proxy.
  const amount = Number(tx.amount) || 0;
  const amountUsdSnapshot = Number(tx.amountUsdSnapshot) || amount;
  const exchangeRateToUsd = Number(tx.exchangeRateToUsd) || 1;

  const doc = createElement(PaymentReceiptDocument, {
    qrDataUrl: qr,
    language: pdfLangFromQuery(req.query.lang),
    tx: {
      id: tx._id.toString(),
      kind: tx.kind,
      amount,
      currency: tx.currency,
      direction: tx.direction,
      txDate: tx.txDate.toISOString(),
      method: tx.method,
      notes: tx.notes ?? "",
      amountUsdSnapshot,
      exchangeRateToUsd,
    },
    counterparty: {
      type: tx.counterparty.type,
      name: partyName,
    },
    org: { name: env.ORG_NAME },
  });

  let stream;
  try {
    stream = await renderToStream(doc as any);
  } catch (err) {
    // react-pdf render errors are otherwise opaque — log the full payload
    // shape so we can reproduce the failure offline.
    logger.error(
      {
        err,
        txId: tx._id.toString(),
        kind: tx.kind,
        currency: tx.currency,
        hasNotes: !!tx.notes,
      },
      "payment_pdf_render_failed"
    );
    throw err;
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="payment-${tx._id.toString()}.pdf"`);
  // Header is sent on first pipe write — once that happens we can't switch to
  // 500, but we still surface the cause in logs and end the socket cleanly.
  stream.on("error", (err) => {
    logger.error({ err, txId: tx._id.toString() }, "payment_pdf_stream_failed");
    if (!res.headersSent) res.status(500).end();
    else res.destroy(err);
  });
  stream.pipe(res as unknown as NodeJS.WritableStream);
});
