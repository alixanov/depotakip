import { Router } from "express";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import * as controller from "./reports.controller.js";

const router = Router();
// reports:read закрывает dashboard + per-type + export всем одним guard'ом.
// Раньше доступ был только за requireAuth — любой залогиненный юзер мог
// выгрузить финансовые отчёты в CSV/XLSX.
router.use(requireAuth, requirePermission("reports:read"));

router.get("/dashboard", controller.dashboard);
router.get("/:type/export", controller.exportReport);
router.get("/:type", controller.report);

export default router;
