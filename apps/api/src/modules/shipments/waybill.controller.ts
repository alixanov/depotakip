/* eslint-disable @typescript-eslint/no-explicit-any */
import { createElement } from "react";
import type { Request, Response } from "express";
import { Types } from "mongoose";
import { WaybillDocument, qrDataUrl, renderToStream } from "@sadiyakargo/pdf-templates";
import { notFound, unauthorized } from "../../lib/errors.js";
import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import { pdfLangFromQuery } from "../../lib/pdfLang.js";
import { tenantFilter } from "../../lib/repository.js";
import { Shipment } from "./shipment.model.js";
import { Carrier } from "../carriers/carrier.model.js";
import { InboundLot } from "../lots/lot.model.js";

type IdParams = { id: string };

export const waybillPdf = async (req: Request<IdParams>, res: Response): Promise<void> => {
  if (!req.orgId) throw unauthorized();

  const shipment = await Shipment.findOne(
    tenantFilter(req.orgId, { _id: new Types.ObjectId(req.params.id) })
  );
  if (!shipment) throw notFound("Gönderi bulunamadı");

  const carrier = await Carrier.findById(shipment.carrierId);

  // Resolve the human label per item via the originating lot.
  const lotIds = shipment.items.map((it) => it.lotId);
  const lots = await InboundLot.find({ _id: { $in: lotIds } });
  const lotById = new Map(lots.map((l) => [l._id.toString(), l]));

  const items = shipment.items.map((it) => {
    const lot = lotById.get(it.lotId.toString());
    return { label: lot?.label || "—", qty: it.qty };
  });
  const totalItems = items.reduce((s, it) => s + it.qty, 0);

  const qr = await qrDataUrl(`${env.WEB_BASE_URL}/track/${shipment.publicTrackingToken}`, 240);

  const doc = createElement(WaybillDocument, {
    qrDataUrl: qr,
    language: pdfLangFromQuery(req.query.lang),
    shipment: {
      id: shipment._id.toString(),
      shortCode: shipment.shortCode,
      shipmentDate: shipment.shipmentDate.toISOString(),
      notes: shipment.notes,
      items,
      totalItems,
      carrierFee: shipment.carrierFee,
    },
    carrier: {
      fullName: carrier ? `${carrier.firstName} ${carrier.lastName}` : "—",
      phone: carrier?.phone || "—",
    },
    recipient: shipment.recipient,
    org: { name: env.ORG_NAME },
  });

  let stream;
  try {
    stream = await renderToStream(doc as any);
  } catch (err) {
    logger.error(
      { err, shipmentId: shipment._id.toString(), shortCode: shipment.shortCode },
      "waybill_pdf_render_failed"
    );
    throw err;
  }
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="waybill-${shipment.shortCode}.pdf"`);
  stream.on("error", (err) => {
    logger.error({ err, shipmentId: shipment._id.toString() }, "waybill_pdf_stream_failed");
    if (!res.headersSent) res.status(500).end();
    else res.destroy(err);
  });
  stream.pipe(res as unknown as NodeJS.WritableStream);
};
