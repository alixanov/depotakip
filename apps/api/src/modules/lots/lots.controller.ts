import type { Request, Response } from "express";
import type { CreateLotInput, UpdateLotInput } from "@sadiyakargo/shared";
import { unauthorized } from "../../lib/errors.js";
import * as service from "./lots.service.js";

type IdParams = { id: string };

export const list = async (req: Request, res: Response): Promise<void> => {
  if (!req.orgId) throw unauthorized();
  const q = req.query as Record<string, string | undefined>;
  res.json(
    await service.list(req.orgId, {
      page: q.page ? Number(q.page) : undefined,
      limit: q.limit ? Number(q.limit) : undefined,
      sort: q.sort,
      senderId: q.senderId,
      status: q.status,
      from: q.from,
      to: q.to,
      availableOnly: q.available === "true",
    })
  );
};

export const get = async (req: Request<IdParams>, res: Response): Promise<void> => {
  if (!req.orgId) throw unauthorized();
  res.json(await service.get(req.orgId, req.params.id));
};

export const create = async (req: Request, res: Response): Promise<void> => {
  if (!req.orgId) throw unauthorized();
  res.status(201).json(await service.create(req.orgId, req.body as CreateLotInput));
};

export const update = async (req: Request<IdParams>, res: Response): Promise<void> => {
  if (!req.orgId) throw unauthorized();
  res.json(await service.update(req.orgId, req.params.id, req.body as UpdateLotInput));
};

export const remove = async (req: Request<IdParams>, res: Response): Promise<void> => {
  if (!req.orgId) throw unauthorized();
  await service.remove(req.orgId, req.params.id);
  res.json({ ok: true });
};

export const stockBySender = async (req: Request, res: Response): Promise<void> => {
  if (!req.orgId) throw unauthorized();
  res.json(await service.stockBySender(req.orgId));
};

export const shipmentsForLot = async (req: Request<IdParams>, res: Response): Promise<void> => {
  if (!req.orgId) throw unauthorized();
  res.json(await service.shipmentsForLot(req.orgId, req.params.id));
};

type PhotoParams = { id: string; photoId: string };

export const addPhotos = async (req: Request<IdParams>, res: Response): Promise<void> => {
  if (!req.orgId) throw unauthorized();
  const files = (req.files ?? []) as Express.Multer.File[];
  res.status(201).json(await service.addPhotos(req.orgId, req.params.id, files));
};

export const getPhotoUrl = async (req: Request<PhotoParams>, res: Response): Promise<void> => {
  if (!req.orgId) throw unauthorized();
  res.json(await service.getPhotoUrl(req.orgId, req.params.id, req.params.photoId));
};

export const removePhoto = async (req: Request<PhotoParams>, res: Response): Promise<void> => {
  if (!req.orgId) throw unauthorized();
  res.json(await service.removePhoto(req.orgId, req.params.id, req.params.photoId));
};

export const reorderPhotos = async (req: Request<IdParams>, res: Response): Promise<void> => {
  if (!req.orgId) throw unauthorized();
  const body = req.body as { photoIds: string[] };
  res.json(await service.reorderPhotos(req.orgId, req.params.id, body.photoIds));
};
