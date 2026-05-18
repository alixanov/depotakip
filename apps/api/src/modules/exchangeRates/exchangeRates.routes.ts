import { Router } from "express";
import { createExchangeRateSchema, idParamSchema } from "@sadiyakargo/shared";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./exchangeRates.controller.js";

const router = Router();
router.use(requireAuth);

router.get("/", requirePermission("exchange_rates:read"), controller.list);
router.post(
  "/",
  requirePermission("exchange_rates:manage"),
  validate({ body: createExchangeRateSchema }),
  controller.create
);
router.delete(
  "/:id",
  requirePermission("exchange_rates:manage"),
  validate({ params: idParamSchema }),
  controller.remove
);

export default router;
