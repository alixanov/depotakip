import type { Request, Response } from "express";
import type { CreateLotInput, UpdateLotInput } from "@sadiyakargo/shared";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { unauthorized } from "../../lib/errors.js";
import * as service from "./lots.service.js";

type IdParams = { id: string };

export const list = asyncHandler(async (req: Request, res: Response) => {
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
});

export const get = asyncHandler<IdParams>(async (req, res) => {
  if (!req.orgId) throw unauthorized();
  res.json(await service.get(req.orgId, req.params.id));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  if (!req.orgId) throw unauthorized();
  res.status(201).json(await service.create(req.orgId, req.body as CreateLotInput));
});

export const update = asyncHandler<IdParams>(async (req, res) => {
  if (!req.orgId) throw unauthorized();
  res.json(await service.update(req.orgId, req.params.id, req.body as UpdateLotInput));
});

export const remove = asyncHandler<IdParams>(async (req, res) => {
  if (!req.orgId) throw unauthorized();
  await service.remove(req.orgId, req.params.id);
  res.json({ ok: true });
});

export const stockBySender = asyncHandler(async (req: Request, res: Response) => {
  if (!req.orgId) throw unauthorized();
  res.json(await service.stockBySender(req.orgId));
});

type PhotoParams = { id: string; photoId: string };

export const addPhotos = asyncHandler<IdParams>(async (req, res) => {
  if (!req.orgId) throw unauthorized();
  const files = (req.files ?? []) as Express.Multer.File[];
  res.status(201).json(await service.addPhotos(req.orgId, req.params.id, files));
});

export const getPhotoUrl = asyncHandler<PhotoParams>(async (req, res) => {
  if (!req.orgId) throw unauthorized();
  res.json(await service.getPhotoUrl(req.orgId, req.params.id, req.params.photoId));
});

export const removePhoto = asyncHandler<PhotoParams>(async (req, res) => {
  if (!req.orgId) throw unauthorized();
  res.json(await service.removePhoto(req.orgId, req.params.id, req.params.photoId));
});
