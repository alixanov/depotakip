import type { Request, Response } from "express";
import type { CreateCarrierInput, UpdateCarrierInput } from "@depotakip/shared";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { unauthorized } from "../../lib/errors.js";
import * as service from "./carriers.service.js";

type IdParams = { id: string };

export const list = asyncHandler(async (req: Request, res: Response) => {
  if (!req.orgId) throw unauthorized();
  const q = req.query as { page?: string; limit?: string; q?: string };
  res.json(
    await service.list(req.orgId, {
      page: q.page ? Number(q.page) : undefined,
      limit: q.limit ? Number(q.limit) : undefined,
      search: q.q,
    })
  );
});

export const get = asyncHandler<IdParams>(async (req, res) => {
  if (!req.orgId) throw unauthorized();
  res.json(await service.get(req.orgId, req.params.id));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  if (!req.orgId) throw unauthorized();
  res.status(201).json(await service.create(req.orgId, req.body as CreateCarrierInput));
});

export const update = asyncHandler<IdParams>(async (req, res) => {
  if (!req.orgId) throw unauthorized();
  res.json(await service.update(req.orgId, req.params.id, req.body as UpdateCarrierInput));
});

export const remove = asyncHandler<IdParams>(async (req, res) => {
  if (!req.orgId) throw unauthorized();
  await service.remove(req.orgId, req.params.id);
  res.json({ ok: true });
});
