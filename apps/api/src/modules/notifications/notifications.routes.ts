import { Router } from "express";
import { createTemplateSchema, idParamSchema, updateTemplateSchema } from "@sadiyakargo/shared";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./notifications.controller.js";

const router = Router();
router.use(requireAuth);

router.get("/templates", controller.listTemplates);
router.get("/templates/:id", validate({ params: idParamSchema }), controller.getTemplate);
router.post(
  "/templates",
  requireRole("admin"),
  validate({ body: createTemplateSchema }),
  controller.createTemplate
);
router.patch(
  "/templates/:id",
  requireRole("admin"),
  validate({ params: idParamSchema, body: updateTemplateSchema }),
  controller.updateTemplate
);
router.delete(
  "/templates/:id",
  requireRole("admin"),
  validate({ params: idParamSchema }),
  controller.removeTemplate
);

router.get("/logs", controller.listLogs);

export default router;
