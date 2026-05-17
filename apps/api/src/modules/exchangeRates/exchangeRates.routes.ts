import { Router } from "express";
import { createExchangeRateSchema, idParamSchema } from "@sadiyakargo/shared";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./exchangeRates.controller.js";

const router = Router();
router.use(requireAuth);

router.get("/", controller.list);
router.post(
  "/",
  requireRole("admin"),
  validate({ body: createExchangeRateSchema }),
  controller.create
);
router.delete("/:id", requireRole("admin"), validate({ params: idParamSchema }), controller.remove);

export default router;
