import { Router } from "express";
import { createCategorySchema, idParamSchema, updateCategorySchema } from "@depotakip/shared";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./categories.controller.js";

const router = Router();
router.use(requireAuth);

router.get("/", controller.list);
router.get("/:id", validate({ params: idParamSchema }), controller.get);
router.post("/", requireRole("admin"), validate({ body: createCategorySchema }), controller.create);
router.patch(
  "/:id",
  requireRole("admin"),
  validate({ params: idParamSchema, body: updateCategorySchema }),
  controller.update
);
router.delete("/:id", requireRole("admin"), validate({ params: idParamSchema }), controller.remove);

export default router;
