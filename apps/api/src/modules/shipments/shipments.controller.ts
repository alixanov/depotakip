import type { Request, Response } from "express";
import type { CreateShipmentInput, Status, UpdateShipmentStatusInput } from "@sadiyakargo/shared";
import { forbidden, unauthorized } from "../../lib/errors.js";
import * as service from "./shipments.service.js";

type IdParams = { id: string };

export const list = async (req: Request, res: Response): Promise<void> => {
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
};

export const get = async (req: Request<IdParams>, res: Response): Promise<void> => {
  if (!req.orgId) throw unauthorized();
  res.json(await service.get(req.orgId, req.params.id));
};

export const create = async (req: Request, res: Response): Promise<void> => {
  if (!req.orgId || !req.userId) throw unauthorized();
  res
    .status(201)
    .json(await service.create(req.orgId, req.userId, req.body as CreateShipmentInput));
};

export const updateStatus = async (req: Request<IdParams>, res: Response): Promise<void> => {
  if (!req.orgId || !req.userId) throw unauthorized();
  const body = req.body as UpdateShipmentStatusInput;
  // Отдельная проверка `shipments:cancel`: маршрут гейтуется shipments:write
  // целиком, но перевод в `iptal` запускает реверс qtyAvailable + reverse
  // adjustments — отдельная финансовая операция. Кастомная роль может иметь
  // write без cancel; раньше эта семантика не enforced (можно было отменить
  // через тот же эндпоинт).
  if (body.status === "iptal" && !req.userPermissions?.includes("shipments:cancel")) {
    throw forbidden("Yetkisiz işlem (gerekli: shipments:cancel)");
  }
  res.json(
    await service.updateStatus(
      req.orgId,
      req.userId,
      req.params.id,
      body.status,
      body.comment ?? ""
    )
  );
};

export const publicTrack = async (
  req: Request<{ token: string }>,
  res: Response
): Promise<void> => {
  res.json(await service.findByTrackingToken(req.params.token));
};
