/* eslint-disable @typescript-eslint/no-explicit-any */
import { createElement } from "react";
import { Types } from "mongoose";
import { ReceiptDocument, qrDataUrl, renderToStream } from "@sadiyakargo/pdf-templates";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { notFound, unauthorized } from "../../lib/errors.js";
import { env } from "../../config/env.js";
import { tenantFilter } from "../../lib/repository.js";
import { InboundLot } from "./lot.model.js";
import { Sender } from "../senders/sender.model.js";
import { Category } from "../categories/category.model.js";

type IdParams = { id: string };

export const receiptPdf = asyncHandler<IdParams>(async (req, res) => {
  if (!req.orgId) throw unauthorized();

  const lot = await InboundLot.findOne(
    tenantFilter(req.orgId, { _id: new Types.ObjectId(req.params.id) })
  );
  if (!lot) throw notFound("Parti bulunamadı");

  const [sender, category] = await Promise.all([
    Sender.findById(lot.senderId),
    Category.findById(lot.categoryId),
  ]);

  const qr = await qrDataUrl(`${env.WEB_BASE_URL}/depo/lots/${lot._id.toString()}`, 240);

  const doc = createElement(ReceiptDocument, {
    qrDataUrl: qr,
    lot: {
      id: lot._id.toString(),
      receivedAt: lot.receivedAt.toISOString(),
      qtyIn: lot.qtyIn,
      notes: lot.notes,
    },
    sender: {
      fullName: sender?.fullName || "—",
      phone: sender?.phone || "—",
    },
    category: {
      name: category?.name || "—",
    },
    org: { name: "Depo Yönetim" },
  });

  // @react-pdf typings only accept `Document` elements; ReceiptDocument
  // already wraps one — bypass the narrow signature with a cast.
  const stream = await renderToStream(doc as any);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="receipt-${lot._id.toString()}.pdf"`);
  stream.pipe(res as unknown as NodeJS.WritableStream);
});
