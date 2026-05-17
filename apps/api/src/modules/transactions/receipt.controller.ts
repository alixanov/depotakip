/* eslint-disable @typescript-eslint/no-explicit-any */
import { createElement } from "react";
import { Types } from "mongoose";
import { PaymentReceiptDocument, qrDataUrl, renderToStream } from "@depotakip/pdf-templates";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { notFound, unauthorized } from "../../lib/errors.js";
import { env } from "../../config/env.js";
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

  const doc = createElement(PaymentReceiptDocument, {
    qrDataUrl: qr,
    tx: {
      id: tx._id.toString(),
      kind: tx.kind,
      amount: tx.amount,
      currency: tx.currency,
      direction: tx.direction,
      txDate: tx.txDate.toISOString(),
      method: tx.method,
      notes: tx.notes,
      amountUsdSnapshot: tx.amountUsdSnapshot,
      exchangeRateToUsd: tx.exchangeRateToUsd,
    },
    counterparty: {
      type: tx.counterparty.type,
      name: partyName,
    },
    org: { name: "Depo Yönetim" },
  });

  const stream = await renderToStream(doc as any);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="payment-${tx._id.toString()}.pdf"`);
  stream.pipe(res as unknown as NodeJS.WritableStream);
});
