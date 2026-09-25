import { z } from "zod";
import { USER_SORT_FIELDS, type UserQuery } from "@/types/users";
import { ROLES, type Role } from "@/types/security";
import { validatePasswordPolicy } from "@/security/password";

/**
 * Securis - User management validation
 *
 * Password policy is enforced here (on creation) with the same module the auth
 * service uses, so a user can never be created with a password the platform
 * would not accept.
 *
 * Connection: app/api/users/**, app/(soc)/users/**.
 */

export const DEFAULT_USER_PAGE_SIZE = 25;
export const MAX_USER_PAGE_SIZE = 100;

export type RawSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}

const querySchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(10).max(MAX_USER_PAGE_SIZE).catch(DEFAULT_USER_PAGE_SIZE),
  search: z.string().trim().min(1).max(200).optional().catch(undefined),
  role: z.string().optional().catch(undefined),
  active: z.enum(["true", "false"]).optional().catch(undefined),
  sortBy: z.enum(USER_SORT_FIELDS).catch("name"),
  sortDir: z.enum(["asc", "desc"]).catch("asc"),
});

/** Validate and coerce raw search params into a `UserQuery`. Never throws. */
export function parseUserQuery(input: RawSearchParams): UserQuery {
  const parsed = querySchema.parse({
    page: first(input.page),
    pageSize: first(input.pageSize),
    search: first(input.search),
    role: first(input.role),
    active: first(input.active),
    sortBy: first(input.sortBy),
    sortDir: first(input.sortDir),
  });

  const allowed = new Set<string>(ROLES);
  const role = parsed.role
    ? parsed.role
        .split(",")
        .map((part) => part.trim().toUpperCase())
        .filter((part): part is Role => allowed.has(part))
    : [];

  return {
    page: parsed.page,
    pageSize: parsed.pageSize,
    search: parsed.search,
    role,
    active: parsed.active === undefined ? undefined : parsed.active === "true",
    sortBy: parsed.sortBy,
    sortDir: parsed.sortDir,
  };
}

// -----------------------------------------------------------------------------
// Mutations
// -----------------------------------------------------------------------------

/** Create a user with a policy-compliant password. */
export const createUserSchema = z
  .object({
    name: z.string().trim().min(2, "Name is required.").max(120),
    email: z.string().trim().min(1).max(254).email("Enter a valid email address."),
    password: z.string().min(1, "Password is required.").max(128),
    role: z.enum(ROLES),
    isActive: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    const policy = validatePasswordPolicy(value.password);
    if (!policy.ok) {
      for (const message of policy.errors) {
        ctx.addIssue({ code: "custom", path: ["password"], message });
      }
    }
  });

export type CreateUserInput = z.infer<typeof createUserSchema>;

/** Update a user's name, role or active state. */
export const updateUserSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    role: z.enum(ROLES).optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined || value.role !== undefined || value.isActive !== undefined,
    { message: "No changes supplied." },
  );

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
