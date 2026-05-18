import { Router } from "express";
import { createTemplateSchema, idParamSchema, updateTemplateSchema } from "@sadiyakargo/shared";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./notifications.controller.js";

const router = Router();
router.use(requireAuth);

router.get("/templates", controller.listTemplates);
router.get("/templates/:id", validate({ params: idParamSchema }), controller.getTemplate);
router.post(
  "/templates",
  requirePermission("notifications:manage"),
  validate({ body: createTemplateSchema }),
  controller.createTemplate
);
router.patch(
  "/templates/:id",
  requirePermission("notifications:manage"),
  validate({ params: idParamSchema, body: updateTemplateSchema }),
  controller.updateTemplate
);
router.delete(
  "/templates/:id",
  requirePermission("notifications:manage"),
  validate({ params: idParamSchema }),
  controller.removeTemplate
);

router.get("/logs", controller.listLogs);

export default router;
