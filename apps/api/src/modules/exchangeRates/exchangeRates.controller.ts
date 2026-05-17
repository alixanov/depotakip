import type { Request, Response } from "express";
import type { CreateExchangeRateInput, Currency } from "@sadiyakargo/shared";
import { asyncHandler } from "../../lib/asyncHandler.js";
import * as service from "./exchangeRates.service.js";

type IdParams = { id: string };

export const list = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as { currency?: string; from?: string; to?: string };
  res.json(
    await service.list({
      currency: q.currency as Currency | undefined,
      from: q.from,
      to: q.to,
    })
  );
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await service.create(req.body as CreateExchangeRateInput));
});

export const remove = asyncHandler<IdParams>(async (req, res) => {
  await service.remove(req.params.id);
  res.json({ ok: true });
});
