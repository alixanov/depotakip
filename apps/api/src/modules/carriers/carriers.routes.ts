import { Router } from "express";
import { createCarrierSchema, idParamSchema, updateCarrierSchema } from "@sadiyakargo/shared";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { bulkImportUpload } from "../../middleware/upload.js";
import * as controller from "./carriers.controller.js";

const router = Router();
router.use(requireAuth);

router.get("/import-template.xlsx", requirePermission("carriers:write"), controller.importTemplate);
router.post(
  "/bulk-import",
  requirePermission("carriers:write"),
  bulkImportUpload,
  controller.bulkImport
);

router.get("/", requirePermission("carriers:read"), controller.list);
router.get(
  "/:id",
  requirePermission("carriers:read"),
  validate({ params: idParamSchema }),
  controller.get
);
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
