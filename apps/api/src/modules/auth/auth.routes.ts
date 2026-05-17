import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
} from "@depotakip/shared";
import { env } from "../../config/env.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import * as controller from "./auth.controller.js";

const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_AUTH_WINDOW_MS,
  limit: env.RATE_LIMIT_AUTH_MAX,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => env.NODE_ENV === "test",
  message: {
    error: "Çok fazla deneme, lütfen daha sonra tekrar deneyin",
    code: "RATE_LIMITED",
  },
});

const router = Router();

router.post("/login", authLimiter, validate({ body: loginSchema }), controller.login);
router.post("/refresh", controller.refresh);
router.post("/logout", controller.logout);

router.post(
  "/forgot-password",
  authLimiter,
  validate({ body: forgotPasswordSchema }),
  controller.forgotPassword
);
router.post(
  "/reset-password",
  authLimiter,
  validate({ body: resetPasswordSchema }),
  controller.resetPassword
);

router.get("/me", requireAuth, controller.me);
router.post(
  "/change-password",
  requireAuth,
  validate({ body: changePasswordSchema }),
  controller.changePassword
);

export default router;
