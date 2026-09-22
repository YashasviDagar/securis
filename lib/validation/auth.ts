import { z } from "zod";

/**
 * Securis - Authentication input validation
 *
 * Every external input is validated with Zod before it reaches business logic.
 * These schemas are shared by the API route handlers and (for type inference)
 * the client form.
 */

/**
 * Login payload.
 *
 * The password is only length-checked here (not policy-checked): the policy is
 * enforced when a password is *created*, and rejecting a login for failing the
 * policy would leak information about valid credential shapes.
 */
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required.")
    .max(254, "Email is too long.")
    .email("Enter a valid email address."),
  password: z
    .string()
    .min(1, "Password is required.")
    .max(128, "Password is too long."),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Normalise an email for storage/lookup: lower-case and trim. Emails are
 * case-insensitive in practice, and normalising prevents duplicate accounts
 * that differ only by case.
 */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}
