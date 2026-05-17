import type { Request, Response } from "express";
import type {
  CreateTemplateInput,
  NotificationTemplateKey,
  UpdateTemplateInput,
} from "@depotakip/shared";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { unauthorized } from "../../lib/errors.js";
import * as service from "./templates.service.js";
import * as notifications from "./notifications.service.js";

type IdParams = { id: string };

export const listTemplates = asyncHandler(async (req: Request, res: Response) => {
  if (!req.orgId) throw unauthorized();
  res.json(await service.list(req.orgId));
});

export const getTemplate = asyncHandler<IdParams>(async (req, res) => {
  if (!req.orgId) throw unauthorized();
  res.json(await service.get(req.orgId, req.params.id));
});

export const createTemplate = asyncHandler(async (req: Request, res: Response) => {
  if (!req.orgId) throw unauthorized();
  res.status(201).json(await service.create(req.orgId, req.body as CreateTemplateInput));
});

export const updateTemplate = asyncHandler<IdParams>(async (req, res) => {
  if (!req.orgId) throw unauthorized();
  res.json(await service.update(req.orgId, req.params.id, req.body as UpdateTemplateInput));
});

export const removeTemplate = asyncHandler<IdParams>(async (req, res) => {
  if (!req.orgId) throw unauthorized();
  await service.remove(req.orgId, req.params.id);
  res.json({ ok: true });
});

export const listLogs = asyncHandler(async (req: Request, res: Response) => {
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
});
