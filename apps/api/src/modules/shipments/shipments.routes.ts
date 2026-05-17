import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { createShipmentSchema, idParamSchema, updateShipmentStatusSchema } from "@depotakip/shared";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { idempotency } from "../../middleware/idempotency.js";
import { env } from "../../config/env.js";
import * as controller from "./shipments.controller.js";
import { waybillPdf } from "./waybill.controller.js";

const router = Router();
router.use(requireAuth);

router.get("/", controller.list);
router.get("/:id/waybill.pdf", validate({ params: idParamSchema }), waybillPdf);
router.get("/:id", validate({ params: idParamSchema }), controller.get);
router.post(
  "/",
  requireRole("admin", "operator"),
  idempotency,
  validate({ body: createShipmentSchema }),
  controller.create
);
router.patch(
  "/:id/status",
  requireRole("admin", "operator"),
  validate({ params: idParamSchema, body: updateShipmentStatusSchema }),
  controller.updateStatus
);

export default router;

// --------------------------------------------------------------------
// Public tracking — no auth, tight rate-limit, masked response (no money).
// Mounted separately under /api/v1/public/track.
// --------------------------------------------------------------------
export const publicRouter = Router();

const tokenParamSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{40}$/),
});

publicRouter.use(
  rateLimit({
    windowMs: env.RATE_LIMIT_PUBLIC_TRACK_WINDOW_MS,
    limit: env.RATE_LIMIT_PUBLIC_TRACK_MAX,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip: () => env.NODE_ENV === "test",
  })
);

publicRouter.get("/:token", validate({ params: tokenParamSchema }), controller.publicTrack);
