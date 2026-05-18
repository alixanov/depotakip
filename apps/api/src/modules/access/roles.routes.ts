import { Router } from "express";
import { createRoleSchema, idParamSchema, updateRoleSchema } from "@sadiyakargo/shared";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./roles.controller.js";

const router = Router();
router.use(requireAuth);

router.get("/", requirePermission("roles:manage"), controller.list);
router.get(
  "/:id",
  requirePermission("roles:manage"),
  validate({ params: idParamSchema }),
  controller.get
);
router.post(
  "/",
  requirePermission("roles:manage"),
  validate({ body: createRoleSchema }),
  controller.create
);
router.patch(
  "/:id",
  requirePermission("roles:manage"),
  validate({ params: idParamSchema, body: updateRoleSchema }),
  controller.update
);
router.delete(
  "/:id",
  requirePermission("roles:manage"),
  validate({ params: idParamSchema }),
  controller.remove
);

export default router;
