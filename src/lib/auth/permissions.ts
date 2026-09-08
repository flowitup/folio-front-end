/**
 * Single permission-check helper module — company-as-tenant model.
 *
 * Replaces the scattered raw `"*:*"` checks across the app plus the old
 * `project-permissions.ts` (`canOnProject`) and `billing-access.ts`. Every
 * gate in the UI must go through one of the three primitives below so a
 * future rename of the platform-ops signal (currently the legacy `*:*`
 * wildcard permission) only touches this file.
 *
 * Model recap (roles-permissions-redesign plan, D-decisions):
 * - Company is the tenant; a user holds exactly one role per company
 *   (admin | manager | member), carried in `user.companies[]` (per-company,
 *   NOT the global JWT `permissions` claim — that claim carries identity-only
 *   legacy global permissions and the platform-ops wildcard).
 * - `project:create` / `project:delete` / `company:manage_*` are admin-only
 *   capabilities never present in the JWT `permissions` claim for a plain
 *   company admin — gate those on `isCompanyAdmin()`, not `can()`.
 * - Per-project actions (`project:update`, `project:manage_labor`, ...) are
 *   resolved server-side into `project.my_permissions` (global ∪ project
 *   effective permissions, D8 grants/denies already applied) — gate those on
 *   `can(permission, globalPerms, projectMyPermissions)`.
 * - `isPlatformOps` is the flowitup-support escape hatch (D5): today it is
 *   simply `permissions.includes("*:*")`; kept as a named function so the
 *   day BE ships a real `is_platform_ops` flag, only this file changes.
 */

export type CompanyRole = "admin" | "manager" | "member";

/** One company the user is attached to — mirrors BE `UserCompanySummary`. */
export interface UserCompanySummary {
  id: string;
  legal_name: string;
  role: CompanyRole;
  is_primary: boolean;
}

const SUPERADMIN_WILDCARD = "*:*";

/**
 * Core permission check: does `permission` appear (exact, resource wildcard,
 * or global `*:*`) in the union of the caller's global JWT permissions and
 * an optional project-scoped effective permission set
 * (`project.my_permissions`, already resolver-computed by the backend)?
 *
 * This is the direct replacement for the old `canOnProject()` — same
 * 3-argument shape so existing call sites only need the import + name
 * updated.
 */
export function can(
  permission: string,
  globalPerms: string[] | undefined | null,
  projectPerms?: string[] | undefined | null
): boolean {
  const perms = new Set([...(globalPerms ?? []), ...(projectPerms ?? [])]);
  if (perms.has(permission) || perms.has(SUPERADMIN_WILDCARD)) return true;
  const resource = permission.split(":")[0];
  return perms.has(`${resource}:*`);
}

/**
 * Platform-ops escape hatch (D5): flowitup support staff, not a company role.
 * Today this is exactly the legacy `*:*` wildcard permission on the JWT.
 */
export function isPlatformOps(permissions: string[] | undefined | null): boolean {
  return (permissions ?? []).includes(SUPERADMIN_WILDCARD);
}

/**
 * Company-admin check. Company-scoped admin-only actions (create/delete a
 * project, manage company members/settings/billing) are never carried on the
 * JWT `permissions` claim for a non-platform-ops user — they must be derived
 * from the caller's per-company role in `user.companies[]`.
 *
 * Pass `companyId` to check admin-of-THIS-company (e.g. gating a specific
 * company's settings page); omit it to check admin-of-ANY-company (e.g.
 * gating the global "New project" button, which any company admin may use).
 * Platform ops always passes — see `isPlatformOps`.
 */
export function isCompanyAdmin(
  companies: UserCompanySummary[] | undefined | null,
  companyId?: string | null,
  permissions?: string[] | undefined | null
): boolean {
  if (isPlatformOps(permissions)) return true;
  const list = companies ?? [];
  if (companyId) {
    return list.some((c) => c.id === companyId && c.role === "admin");
  }
  return list.some((c) => c.role === "admin");
}

/**
 * "New project" / project-creation gate: platform ops (`*:*`) OR admin of
 * at least one company (new model — admin is implicit project:create on
 * every project of their company).
 *
 * Deliberately ignores the legacy global `project:create` permission on its
 * own: in the company-as-tenant model that claim can be present on a plain
 * member/manager JWT without company-admin standing, which would let them
 * create a project outside any company they administer.
 */
export function canCreateProject(
  permissions: string[] | undefined | null,
  companies: UserCompanySummary[] | undefined | null
): boolean {
  return isCompanyAdmin(companies, null, permissions);
}
