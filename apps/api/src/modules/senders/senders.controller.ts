import type { Request, Response } from "express";
import type { CreateSenderInput, UpdateSenderInput } from "@sadiyakargo/shared";
import { unauthorized } from "../../lib/errors.js";
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
