import type { Request, Response } from "express";
import type { CreateTransactionInput, TransactionKind } from "@sadiyakargo/shared";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { unauthorized } from "../../lib/errors.js";
import * as service from "./transactions.service.js";

type IdParams = { id: string };

export const list = asyncHandler(async (req: Request, res: Response) => {
  if (!req.orgId) throw unauthorized();
  const q = req.query as Record<string, string | undefined>;
  res.json(
    await service.list(req.orgId, {
      page: q.page ? Number(q.page) : undefined,
      limit: q.limit ? Number(q.limit) : undefined,
      counterpartyType: q.counterpartyType as "carrier" | "sender" | undefined,
      counterpartyId: q.counterpartyId,
      shipmentId: q.shipmentId,
      kind: q.kind as TransactionKind | undefined,
      from: q.from,
      to: q.to,
      sort: q.sort,
    })
  );
});

export const get = asyncHandler<IdParams>(async (req, res) => {
  if (!req.orgId) throw unauthorized();
  res.json(await service.get(req.orgId, req.params.id));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  if (!req.orgId) throw unauthorized();
  res
    .status(201)
    .json(await service.registerPayment(req.orgId, req.body as CreateTransactionInput));
});

export const carrierBalances = asyncHandler(async (req: Request, res: Response) => {
  if (!req.orgId) throw unauthorized();
  res.json(await service.carrierBalances(req.orgId));
});

export const senderBalances = asyncHandler(async (req: Request, res: Response) => {
  if (!req.orgId) throw unauthorized();
  res.json(await service.senderBalances(req.orgId));
});
