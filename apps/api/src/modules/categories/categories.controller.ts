import type { Request, Response } from "express";
import type { CreateCategoryInput, UpdateCategoryInput } from "@depotakip/shared";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { unauthorized } from "../../lib/errors.js";
import * as service from "./categories.service.js";

type IdParams = { id: string };

export const list = asyncHandler(async (req: Request, res: Response) => {
  if (!req.orgId) throw unauthorized();
  const activeOnly = req.query.active === "true";
  res.json(await service.list(req.orgId, { activeOnly }));
});

export const get = asyncHandler<IdParams>(async (req, res) => {
  if (!req.orgId) throw unauthorized();
  res.json(await service.get(req.orgId, req.params.id));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  if (!req.orgId) throw unauthorized();
  res.status(201).json(await service.create(req.orgId, req.body as CreateCategoryInput));
});

export const update = asyncHandler<IdParams>(async (req, res) => {
  if (!req.orgId) throw unauthorized();
  res.json(await service.update(req.orgId, req.params.id, req.body as UpdateCategoryInput));
});

export const remove = asyncHandler<IdParams>(async (req, res) => {
  if (!req.orgId) throw unauthorized();
  await service.remove(req.orgId, req.params.id);
  res.json({ ok: true });
});
