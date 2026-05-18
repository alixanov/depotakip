import { Router } from "express";
import {
  createLotSchema,
  idParamSchema,
  lotPhotoIdParamSchema,
  reorderPhotosSchema,
  updateLotSchema,
} from "@sadiyakargo/shared";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
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
router.get("/:id/shipments", validate({ params: idParamSchema }), controller.shipmentsForLot);

router.get("/", controller.list);
router.get("/:id", validate({ params: idParamSchema }), controller.get);

router.post(
  "/",
  requirePermission("lots:write"),
  validate({ body: createLotSchema }),
  controller.create
);
router.patch(
  "/:id",
  requirePermission("lots:write"),
  validate({ params: idParamSchema, body: updateLotSchema }),
  controller.update
);
router.delete(
  "/:id",
  requirePermission("lots:delete"),
  validate({ params: idParamSchema }),
  controller.remove
);

// ── Photos ────────────────────────────────────────────────────────────────
router.post(
  "/:id/photos",
  requirePermission("lots:write"),
  validate({ params: idParamSchema }),
  lotPhotoUpload,
  controller.addPhotos
);
router.get(
  "/:id/photos/:photoId",
  validate({ params: lotPhotoIdParamSchema }),
  controller.getPhotoUrl
);
router.patch(
  "/:id/photos/order",
  requirePermission("lots:write"),
  validate({ params: idParamSchema, body: reorderPhotosSchema }),
  controller.reorderPhotos
);
router.delete(
  "/:id/photos/:photoId",
  requirePermission("lots:photos:delete"),
  validate({ params: lotPhotoIdParamSchema }),
  controller.removePhoto
);

export default router;
