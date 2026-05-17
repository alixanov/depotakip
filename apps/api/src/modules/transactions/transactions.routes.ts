import { Router } from "express";
import { createTransactionSchema, idParamSchema } from "@sadiyakargo/shared";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { idempotency } from "../../middleware/idempotency.js";
import * as controller from "./transactions.controller.js";
import { paymentReceiptPdf } from "./receipt.controller.js";

const router = Router();
router.use(requireAuth);

router.get("/balances/carriers", controller.carrierBalances);
router.get("/balances/senders", controller.senderBalances);

router.get("/", controller.list);
router.get("/:id/receipt.pdf", validate({ params: idParamSchema }), paymentReceiptPdf);
router.get("/:id", validate({ params: idParamSchema }), controller.get);

router.post(
  "/",
  requireRole("admin", "operator"),
  idempotency,
  validate({ body: createTransactionSchema }),
  controller.create
);

export default router;
