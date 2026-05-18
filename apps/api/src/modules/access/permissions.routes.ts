import { Router } from "express";
import { createPermissionSchema, idParamSchema, updatePermissionSchema } from "@sadiyakargo/shared";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./permissions.controller.js";

const router = Router();
router.use(requireAuth);

// The catalogue is readable by anyone who can manage roles or permissions,
// because the admin Roles page renders it as the matrix axis.
router.get("/", requirePermission("roles:manage"), controller.list);
router.get(
  "/:id",
  requirePermission("permissions:manage"),
  validate({ params: idParamSchema }),
  controller.get
);
router.post(
  "/",
  requirePermission("permissions:manage"),
  validate({ body: createPermissionSchema }),
  controller.create
);
router.patch(
  "/:id",
  requirePermission("permissions:manage"),
  validate({ params: idParamSchema, body: updatePermissionSchema }),
  controller.update
);
router.delete(
  "/:id",
  requirePermission("permissions:manage"),
  validate({ params: idParamSchema }),
  controller.remove
);

export default router;
