import { Router } from "express";
import { createSenderSchema, idParamSchema, updateSenderSchema } from "@sadiyakargo/shared";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { bulkImportUpload } from "../../middleware/upload.js";
import * as controller from "./senders.controller.js";

const router = Router();
router.use(requireAuth);

// Bulk-import + template — оба под senders:write.
// Шаблон тоже за write (а не за read): операторам без write он не нужен,
// а раздавать его публично смысла нет.
router.get("/import-template.xlsx", requirePermission("senders:write"), controller.importTemplate);
router.post(
  "/bulk-import",
  requirePermission("senders:write"),
  bulkImportUpload,
  controller.bulkImport
);

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
