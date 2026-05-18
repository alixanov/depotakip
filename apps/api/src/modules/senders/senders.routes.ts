import { Router } from "express";
import { createSenderSchema, idParamSchema, updateSenderSchema } from "@sadiyakargo/shared";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./senders.controller.js";

const router = Router();
router.use(requireAuth);

router.get("/", requirePermission("senders:read"), controller.list);
router.get(
  "/:id",
  requirePermission("senders:read"),
  validate({ params: idParamSchema }),
  controller.get
);
router.post(
  "/",
  requirePermission("senders:write"),
  validate({ body: createSenderSchema }),
  controller.create
);
router.patch(
  "/:id",
  requirePermission("senders:write"),
  validate({ params: idParamSchema, body: updateSenderSchema }),
  controller.update
);
router.delete(
  "/:id",
  requirePermission("senders:delete"),
  validate({ params: idParamSchema }),
  controller.remove
);

export default router;
