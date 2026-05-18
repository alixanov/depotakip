import type { Request, Response } from "express";
import type { CreateExchangeRateInput, Currency } from "@sadiyakargo/shared";
import * as service from "./exchangeRates.service.js";

type IdParams = { id: string };

export const list = async (req: Request, res: Response): Promise<void> => {
  const q = req.query as { currency?: string; from?: string; to?: string };
  res.json(
    await service.list({
      currency: q.currency as Currency | undefined,
      from: q.from,
      to: q.to,
    })
  );
};

export const create = async (req: Request, res: Response): Promise<void> => {
  res.status(201).json(await service.create(req.body as CreateExchangeRateInput));
};

export const remove = async (req: Request<IdParams>, res: Response): Promise<void> => {
  await service.remove(req.params.id);
  res.json({ ok: true });
};
