import { z } from 'zod';

export const permissionsSchema = z.object({
  allowMouse: z.boolean().default(false),
  allowKeyboard: z.boolean().default(false),
  allowAudio: z.boolean().default(true),
  allowClipboard: z.boolean().default(false),
  allowFileTransfer: z.boolean().default(false),
});

export const initiateSessionSchema = z.object({
  targetDeviceId: z.string().min(1, 'Target device ID is required'),
  permissions: permissionsSchema.optional(),
});

export const updatePermissionsSchema = z.object({
  permissions: permissionsSchema,
});

export const endSessionSchema = z.object({
  reason: z.string().default('USER_DISCONNECTED'),
});

export type PermissionsInput = z.infer<typeof permissionsSchema>;
export type InitiateSessionInput = z.infer<typeof initiateSessionSchema>;
export type UpdatePermissionsInput = z.infer<typeof updatePermissionsSchema>;
export type EndSessionInput = z.infer<typeof endSessionSchema>;
