import { Router } from "express";
import { createTransactionSchema, idParamSchema } from "@sadiyakargo/shared";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { idempotency } from "../../middleware/idempotency.js";
import * as controller from "./transactions.controller.js";
import { paymentReceiptPdf } from "./receipt.controller.js";

const router = Router();
router.use(requireAuth);

router.get(
  "/balances/carriers",
  requirePermission("transactions:read"),
  controller.carrierBalances
);
router.get("/balances/senders", requirePermission("transactions:read"), controller.senderBalances);

router.get("/", requirePermission("transactions:read"), controller.list);
router.get(
  "/:id/receipt.pdf",
  requirePermission("transactions:read"),
  validate({ params: idParamSchema }),
  paymentReceiptPdf
);
router.get(
  "/:id",
  requirePermission("transactions:read"),
  validate({ params: idParamSchema }),
  controller.get
);

router.post(
  "/",
  requirePermission("transactions:write"),
  idempotency,
  validate({ body: createTransactionSchema }),
  controller.create
);

export default router;
