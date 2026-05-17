import { z } from "zod";
import { ROLES } from "../constants.js";
import { emailSchema, passwordSchema } from "./auth.js";

export const createUserSchema = z.object({
  email: emailSchema,
  fullName: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(40).optional(),
  role: z.enum(ROLES),
});

export const updateUserSchema = z.object({
  fullName: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  role: z.enum(ROLES).optional(),
  active: z.boolean().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
