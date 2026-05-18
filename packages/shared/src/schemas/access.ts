import { z } from "zod";
import { PERMISSION_GROUPS } from "../constants.js";

/**
 * Permission keys are arbitrary user-defined strings of the form
 * `module:action[:sub]`. We don't lock the allow-list here (catalogue is
 * editable via the admin UI), but we keep the shape strict.
 */
const permissionKeySchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9_]+(:[a-z0-9_]+)+$/, "validation:permission_key_format");

export const createPermissionSchema = z.object({
  key: permissionKeySchema,
  label: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  group: z.enum(PERMISSION_GROUPS).optional(),
});

export const updatePermissionSchema = z.object({
  label: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).optional(),
  group: z.enum(PERMISSION_GROUPS).optional(),
});

export const createRoleSchema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(500).optional(),
  permissions: z.array(permissionKeySchema).default([]),
});

export const updateRoleSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  description: z.string().trim().max(500).optional(),
  permissions: z.array(permissionKeySchema).optional(),
});

export type CreatePermissionInput = z.infer<typeof createPermissionSchema>;
export type UpdatePermissionInput = z.infer<typeof updatePermissionSchema>;
export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
