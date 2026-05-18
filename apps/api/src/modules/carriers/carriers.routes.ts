import { Router } from "express";
import { createCarrierSchema, idParamSchema, updateCarrierSchema } from "@sadiyakargo/shared";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./carriers.controller.js";

const router = Router();
router.use(requireAuth);

router.get("/", controller.list);
router.get("/:id", validate({ params: idParamSchema }), controller.get);
router.post(
  "/",
  requirePermission("carriers:write"),
  validate({ body: createCarrierSchema }),
  controller.create
);
router.patch(
  "/:id",
  requirePermission("carriers:write"),
  validate({ params: idParamSchema, body: updateCarrierSchema }),
  controller.update
);
router.delete(
  "/:id",
  requirePermission("carriers:delete"),
  validate({ params: idParamSchema }),
  controller.remove
);

export default router;
