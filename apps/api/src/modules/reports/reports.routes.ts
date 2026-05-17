import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import * as controller from "./reports.controller.js";

const router = Router();
router.use(requireAuth);

router.get("/dashboard", controller.dashboard);
router.get("/:type/export", controller.exportReport);
router.get("/:type", controller.report);

export default router;
