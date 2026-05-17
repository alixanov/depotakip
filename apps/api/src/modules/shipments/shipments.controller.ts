import type { Request, Response } from "express";
import type { CreateShipmentInput, Status, UpdateShipmentStatusInput } from "@sadiyakargo/shared";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { unauthorized } from "../../lib/errors.js";
import * as service from "./shipments.service.js";

type IdParams = { id: string };

export const list = asyncHandler(async (req: Request, res: Response) => {
  if (!req.orgId) throw unauthorized();
  const q = req.query as Record<string, string | undefined>;
  res.json(
    await service.list(req.orgId, {
      page: q.page ? Number(q.page) : undefined,
      limit: q.limit ? Number(q.limit) : undefined,
      status: q.status as Status | undefined,
      attention: q.attention === "true",
      carrierId: q.carrierId,
      from: q.from,
      to: q.to,
      q: q.q,
      sort: q.sort,
    })
  );
});

export const get = asyncHandler<IdParams>(async (req, res) => {
  if (!req.orgId) throw unauthorized();
  res.json(await service.get(req.orgId, req.params.id));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  if (!req.orgId || !req.userId) throw unauthorized();
  res
    .status(201)
    .json(await service.create(req.orgId, req.userId, req.body as CreateShipmentInput));
});

export const updateStatus = asyncHandler<IdParams>(async (req, res) => {
  if (!req.orgId || !req.userId) throw unauthorized();
  const body = req.body as UpdateShipmentStatusInput;
  res.json(
    await service.updateStatus(
      req.orgId,
      req.userId,
      req.params.id,
      body.status,
      body.comment ?? ""
    )
  );
});

export const publicTrack = asyncHandler<{ token: string }>(async (req, res) => {
  res.json(await service.findByTrackingToken(req.params.token));
});
