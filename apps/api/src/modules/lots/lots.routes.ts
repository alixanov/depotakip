import { Router } from "express";
import {
  createLotSchema,
  idParamSchema,
  lotPhotoIdParamSchema,
  updateLotSchema,
} from "@sadiyakargo/shared";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { lotPhotoUpload } from "../../middleware/upload.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./lots.controller.js";
import { receiptPdf } from "./receipt.controller.js";

const router = Router();
router.use(requireAuth);

// Static (non-:id) sub-paths first.
router.get("/stock/by-sender", controller.stockBySender);

// PDF receipt — placed before /:id so it doesn't collide with the wildcard.
router.get("/:id/receipt.pdf", validate({ params: idParamSchema }), receiptPdf);

router.get("/", controller.list);
router.get("/:id", validate({ params: idParamSchema }), controller.get);

router.post(
  "/",
  requireRole("admin", "operator"),
  validate({ body: createLotSchema }),
  controller.create
);
router.patch(
  "/:id",
  requireRole("admin", "operator"),
  validate({ params: idParamSchema, body: updateLotSchema }),
  controller.update
);
router.delete("/:id", requireRole("admin"), validate({ params: idParamSchema }), controller.remove);

// ── Photos ────────────────────────────────────────────────────────────────
router.post(
  "/:id/photos",
  requireRole("admin", "operator"),
  validate({ params: idParamSchema }),
  lotPhotoUpload,
  controller.addPhotos
);
router.get(
  "/:id/photos/:photoId",
  validate({ params: lotPhotoIdParamSchema }),
  controller.getPhotoUrl
);
router.delete(
  "/:id/photos/:photoId",
  requireRole("admin"),
  validate({ params: lotPhotoIdParamSchema }),
  controller.removePhoto
);

export default router;
