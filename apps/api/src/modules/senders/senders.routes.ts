import { Router } from "express";
import { createSenderSchema, idParamSchema, updateSenderSchema } from "@sadiyakargo/shared";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./senders.controller.js";

const router = Router();
router.use(requireAuth);

router.get("/", controller.list);
router.get("/:id", validate({ params: idParamSchema }), controller.get);
router.post(
  "/",
  requireRole("admin", "operator"),
  validate({ body: createSenderSchema }),
  controller.create
);
router.patch(
  "/:id",
  requireRole("admin", "operator"),
  validate({ params: idParamSchema, body: updateSenderSchema }),
  controller.update
);
router.delete("/:id", requireRole("admin"), validate({ params: idParamSchema }), controller.remove);

export default router;
