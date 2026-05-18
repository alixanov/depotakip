import type { Request, Response } from "express";
import type { CreateCarrierInput, UpdateCarrierInput } from "@sadiyakargo/shared";
import { badRequest, unauthorized } from "../../lib/errors.js";
import { buildTemplateXlsx, parseBulkImportFile } from "../../lib/bulkImport.js";
import * as service from "./carriers.service.js";

type IdParams = { id: string };

export const list = async (req: Request, res: Response): Promise<void> => {
  if (!req.orgId) throw unauthorized();
  const q = req.query as { page?: string; limit?: string; q?: string };
  res.json(
    await service.list(req.orgId, {
      page: q.page ? Number(q.page) : undefined,
      limit: q.limit ? Number(q.limit) : undefined,
      search: q.q,
    })
  );
};

export const get = async (req: Request<IdParams>, res: Response): Promise<void> => {
  if (!req.orgId) throw unauthorized();
  res.json(await service.get(req.orgId, req.params.id));
};

export const create = async (req: Request, res: Response): Promise<void> => {
  if (!req.orgId) throw unauthorized();
  res.status(201).json(await service.create(req.orgId, req.body as CreateCarrierInput));
};

export const update = async (req: Request<IdParams>, res: Response): Promise<void> => {
  if (!req.orgId) throw unauthorized();
  res.json(await service.update(req.orgId, req.params.id, req.body as UpdateCarrierInput));
};

export const remove = async (req: Request<IdParams>, res: Response): Promise<void> => {
  if (!req.orgId) throw unauthorized();
  await service.remove(req.orgId, req.params.id);
  res.json({ ok: true });
};

export const bulkImport = async (req: Request, res: Response): Promise<void> => {
  if (!req.orgId) throw unauthorized();
  if (!req.file) throw badRequest("Поле `file` обязательно (multipart/form-data)");
  const parsed = await parseBulkImportFile(
    req.file.buffer,
    req.file.originalname,
    req.file.mimetype
  );
  const onDuplicate = req.query.onDuplicate === "update" ? "update" : "skip";
  res.json(await service.bulkImport(req.orgId, parsed.rows, { onDuplicate }));
};

export const importTemplate = async (_req: Request, res: Response): Promise<void> => {
  const buf = await buildTemplateXlsx([...service.CARRIER_IMPORT_COLUMNS], {
    firstName: "Mehmet",
    lastName: "Yıldız",
    phone: "+905551234567",
    deliveryAddressTr: "İstanbul, Kadıköy",
    notes: "пример строки — удалите перед импортом",
  });
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", 'attachment; filename="carriers-template.xlsx"');
  res.send(buf);
};
