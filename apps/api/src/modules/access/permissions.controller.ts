import type { Request, Response } from "express";
import type { CreatePermissionInput, UpdatePermissionInput } from "@sadiyakargo/shared";
import { asyncHandler } from "../../lib/asyncHandler.js";
import * as service from "./permissions.service.js";

type IdParams = { id: string };

export const list = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await service.list());
});

export const get = asyncHandler<IdParams>(async (req, res) => {
  res.json(await service.get(req.params.id));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await service.create(req.body as CreatePermissionInput));
});

export const update = asyncHandler<IdParams>(async (req, res) => {
  res.json(await service.update(req.params.id, req.body as UpdatePermissionInput));
});

export const remove = asyncHandler<IdParams>(async (req, res) => {
  await service.remove(req.params.id);
  res.json({ ok: true });
});
