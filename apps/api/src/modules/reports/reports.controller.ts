import type { Request, Response } from "express";
import { badRequest, unauthorized } from "../../lib/errors.js";
import * as service from "./reports.service.js";
import { streamReport, type ReportFormat } from "./export.js";

interface RangeQuery {
  from?: string;
  to?: string;
}

export const dashboard = async (req: Request, res: Response): Promise<void> => {
  if (!req.orgId) throw unauthorized();
  const q = req.query as RangeQuery;
  res.json(await service.dashboard(req.orgId, q));
};

const REPORT_DEFS = {
  carriers: {
    fetch: service.carriers,
    columns: [
      { key: "carrierId", header: "Carrier ID" },
      { key: "name", header: "Kargocu" },
      { key: "shipments", header: "Gönderiler" },
      { key: "itemsTotal", header: "Toplam adet" },
      { key: "chargesUsd", header: "Borç USD-cent" },
      { key: "paymentsUsd", header: "Ödeme USD-cent" },
      { key: "balanceUsd", header: "Bakiye USD-cent" },
    ],
  },
  senders: {
    fetch: service.senders,
    columns: [
      { key: "senderId", header: "Sender ID" },
      { key: "name", header: "Gönderici" },
      { key: "lots", header: "Partiler" },
      { key: "qtyIn", header: "Adet" },
      { key: "chargesUsd", header: "Borç USD-cent" },
      { key: "paymentsUsd", header: "Ödeme USD-cent" },
      { key: "balanceUsd", header: "Bakiye USD-cent" },
    ],
  },
  finance: {
    fetch: service.finance,
    columns: [
      { key: "date", header: "Tarih" },
      { key: "carrierChargesUsd", header: "Carrier borç" },
      { key: "carrierPaymentsUsd", header: "Carrier ödeme" },
      { key: "senderChargesUsd", header: "Sender borç" },
      { key: "senderPaymentsUsd", header: "Sender ödeme" },
    ],
  },
} as const;

type ReportType = keyof typeof REPORT_DEFS;

export const report = async (req: Request<{ type: string }>, res: Response): Promise<void> => {
  if (!req.orgId) throw unauthorized();
  const type = req.params.type as ReportType;
  const def = REPORT_DEFS[type];
  if (!def) throw badRequest(`Bilinmeyen rapor: ${type}`);
  const q = req.query as RangeQuery;
  const rows = await def.fetch(req.orgId, q);
  res.json(rows);
};

export const exportReport = async (
  req: Request<{ type: string }>,
  res: Response
): Promise<void> => {
  if (!req.orgId) throw unauthorized();
  const type = req.params.type as ReportType;
  const def = REPORT_DEFS[type];
  if (!def) throw badRequest(`Bilinmeyen rapor: ${type}`);
  const format = ((req.query.format as string) || "csv") as ReportFormat;
  if (format !== "csv" && format !== "xlsx") {
    throw badRequest("format must be csv or xlsx");
  }
  const q = req.query as RangeQuery;
  const rows = (await def.fetch(req.orgId, q)) as unknown as Record<string, unknown>[];
  await streamReport(
    res,
    `report-${type}`,
    [...def.columns] as { header: string; key: string; width?: number }[],
    rows,
    format
  );
};
