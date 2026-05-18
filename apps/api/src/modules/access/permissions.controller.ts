import type { Request, Response } from "express";
import type { CreatePermissionInput, UpdatePermissionInput } from "@sadiyakargo/shared";
import * as service from "./permissions.service.js";

type IdParams = { id: string };

export const list = async (_req: Request, res: Response): Promise<void> => {
  res.json(await service.list());
};

export const get = async (req: Request<IdParams>, res: Response): Promise<void> => {
  res.json(await service.get(req.params.id));
};

export const create = async (req: Request, res: Response): Promise<void> => {
  res.status(201).json(await service.create(req.body as CreatePermissionInput));
};

export const update = async (req: Request<IdParams>, res: Response): Promise<void> => {
  res.json(await service.update(req.params.id, req.body as UpdatePermissionInput));
};

export const remove = async (req: Request<IdParams>, res: Response): Promise<void> => {
  await service.remove(req.params.id);
  res.json({ ok: true });
};
