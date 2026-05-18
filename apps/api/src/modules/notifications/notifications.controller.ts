import type { Request, Response } from "express";
import type {
  CreateTemplateInput,
  NotificationTemplateKey,
  UpdateTemplateInput,
} from "@sadiyakargo/shared";
import { unauthorized } from "../../lib/errors.js";
import * as service from "./templates.service.js";
import * as notifications from "./notifications.service.js";

type IdParams = { id: string };

export const listTemplates = async (req: Request, res: Response): Promise<void> => {
  if (!req.orgId) throw unauthorized();
  res.json(await service.list(req.orgId));
};

export const getTemplate = async (req: Request<IdParams>, res: Response): Promise<void> => {
  if (!req.orgId) throw unauthorized();
  res.json(await service.get(req.orgId, req.params.id));
};

export const createTemplate = async (req: Request, res: Response): Promise<void> => {
  if (!req.orgId) throw unauthorized();
  res.status(201).json(await service.create(req.orgId, req.body as CreateTemplateInput));
};

export const updateTemplate = async (req: Request<IdParams>, res: Response): Promise<void> => {
  if (!req.orgId) throw unauthorized();
  res.json(await service.update(req.orgId, req.params.id, req.body as UpdateTemplateInput));
};

export const removeTemplate = async (req: Request<IdParams>, res: Response): Promise<void> => {
  if (!req.orgId) throw unauthorized();
  await service.remove(req.orgId, req.params.id);
  res.json({ ok: true });
};

export const listLogs = async (req: Request, res: Response): Promise<void> => {
  if (!req.orgId) throw unauthorized();
  const q = req.query as Record<string, string | undefined>;
  res.json(
    await notifications.listLogs(req.orgId, {
      page: q.page ? Number(q.page) : undefined,
      limit: q.limit ? Number(q.limit) : undefined,
      status: q.status as "queued" | "sent" | "failed" | undefined,
      templateKey: q.templateKey as NotificationTemplateKey | undefined,
    })
  );
};
