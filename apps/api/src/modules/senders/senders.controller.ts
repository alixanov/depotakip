import type { Request, Response } from "express";
import type { CreateSenderInput, UpdateSenderInput } from "@sadiyakargo/shared";
import { badRequest, unauthorized } from "../../lib/errors.js";
import { buildTemplateXlsx, parseBulkImportFile } from "../../lib/bulkImport.js";
import * as service from "./senders.service.js";

type IdParams = { id: string };

export const list = async (req: Request, res: Response): Promise<void> => {
  if (!req.orgId) throw unauthorized();
  const q = req.query as { page?: string; limit?: string; q?: string; sort?: string };
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
  res.status(201).json(await service.create(req.orgId, req.body as CreateSenderInput));
};

export const update = async (req: Request<IdParams>, res: Response): Promise<void> => {
  if (!req.orgId) throw unauthorized();
  res.json(await service.update(req.orgId, req.params.id, req.body as UpdateSenderInput));
};

export const remove = async (req: Request<IdParams>, res: Response): Promise<void> => {
  if (!req.orgId) throw unauthorized();
  await service.remove(req.orgId, req.params.id);
  res.json({ ok: true });
};

export const bulkImport = async (req: Request, res: Response): Promise<void> => {
  if (!req.orgId) throw unauthorized();
  if (!req.file) throw badRequest("err:file_required");
  const parsed = await parseBulkImportFile(
    req.file.buffer,
    req.file.originalname,
    req.file.mimetype
  );
  const onDuplicate = req.query.onDuplicate === "update" ? "update" : "skip";
  res.json(await service.bulkImport(req.orgId, parsed.rows, { onDuplicate }));
};

export const importTemplate = async (_req: Request, res: Response): Promise<void> => {
  const buf = await buildTemplateXlsx([...service.SENDER_IMPORT_COLUMNS], {
    fullName: "Akmal Karimov",
    phone: "+998901234567",
    address: "Toshkent, 1-mahalla",
    notes: "пример строки — удалите перед импортом",
  });
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", 'attachment; filename="senders-template.xlsx"');
  res.send(buf);
};
