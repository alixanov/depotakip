import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email("Geçersiz email");
export const passwordSchema = z.string().min(10, "Şifre en az 10 karakter olmalı");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Şifre zorunlu"),
});

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(40).optional(),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export const twoFactorVerifySchema = z.object({
  code: z.string().regex(/^\d{6}$/, "6 hane gerekli"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
