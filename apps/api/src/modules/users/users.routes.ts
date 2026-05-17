import { Router } from "express";
import { createUserSchema, idParamSchema, updateUserSchema } from "@depotakip/shared";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./users.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/", requireRole("admin"), controller.list);
router.get("/:id", requireRole("admin"), validate({ params: idParamSchema }), controller.get);
router.post("/", requireRole("admin"), validate({ body: createUserSchema }), controller.create);
router.patch(
  "/:id",
  requireRole("admin"),
  validate({ params: idParamSchema, body: updateUserSchema }),
  controller.update
);
router.delete("/:id", requireRole("admin"), validate({ params: idParamSchema }), controller.remove);

export default router;
