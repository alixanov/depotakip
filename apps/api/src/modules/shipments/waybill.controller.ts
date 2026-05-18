/* eslint-disable @typescript-eslint/no-explicit-any */
import { createElement } from "react";
import { Types } from "mongoose";
import { WaybillDocument, qrDataUrl, renderToStream } from "@sadiyakargo/pdf-templates";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { notFound, unauthorized } from "../../lib/errors.js";
import { env } from "../../config/env.js";
import { tenantFilter } from "../../lib/repository.js";
import { Shipment } from "./shipment.model.js";
import { Carrier } from "../carriers/carrier.model.js";
import { InboundLot } from "../lots/lot.model.js";

type IdParams = { id: string };

export const waybillPdf = asyncHandler<IdParams>(async (req, res) => {
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
    org: { name: "Depo Yönetim" },
  });

  const stream = await renderToStream(doc as any);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="waybill-${shipment.shortCode}.pdf"`);
  stream.pipe(res as unknown as NodeJS.WritableStream);
});
