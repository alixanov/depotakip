import { z } from "zod";
import { emailSchema, passwordSchema } from "./auth.js";
import { objectIdSchema } from "./common.js";

export const createUserSchema = z.object({
  email: emailSchema,
  fullName: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(40).optional(),
  roleId: objectIdSchema,
});

export const updateUserSchema = z.object({
  fullName: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  roleId: objectIdSchema.optional(),
  active: z.boolean().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
