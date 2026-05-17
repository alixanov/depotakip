import { Router } from "express";
import { createCarrierSchema, idParamSchema, updateCarrierSchema } from "@sadiyakargo/shared";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./carriers.controller.js";

const router = Router();
router.use(requireAuth);

router.get("/", controller.list);
router.get("/:id", validate({ params: idParamSchema }), controller.get);
router.post(
  "/",
  requireRole("admin", "operator"),
  validate({ body: createCarrierSchema }),
  controller.create
);
router.patch(
  "/:id",
  requireRole("admin", "operator"),
  validate({ params: idParamSchema, body: updateCarrierSchema }),
  controller.update
);
router.delete("/:id", requireRole("admin"), validate({ params: idParamSchema }), controller.remove);

export default router;
