import { Router } from "express";
import { createUserSchema, idParamSchema, updateUserSchema } from "@sadiyakargo/shared";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./users.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/", requirePermission("users:manage"), controller.list);
router.get(
  "/:id",
  requirePermission("users:manage"),
  validate({ params: idParamSchema }),
  controller.get
);
router.post(
  "/",
  requirePermission("users:manage"),
  validate({ body: createUserSchema }),
  controller.create
);
router.patch(
  "/:id",
  requirePermission("users:manage"),
  validate({ params: idParamSchema, body: updateUserSchema }),
  controller.update
);
router.delete(
  "/:id",
  requirePermission("users:manage"),
  validate({ params: idParamSchema }),
  controller.remove
);

export default router;
