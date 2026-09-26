import { z } from 'zod';

export const signUpSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(6, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

export const signInSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const connectDeviceSchema = z.object({
  deviceId: z
    .string()
    .min(9, 'Device ID must be 9 digits (e.g. 489-123-789)')
    .regex(/^[\d\s-]+$/, 'Device ID should contain digits only'),
});

export type SignUpFormValues = z.infer<typeof signUpSchema>;
export type SignInFormValues = z.infer<typeof signInSchema>;
export type ConnectDeviceFormValues = z.infer<typeof connectDeviceSchema>;
