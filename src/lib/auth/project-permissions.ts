/**
 * Project-scoped permission check.
 *
 * Gates per-project UI on the caller's EFFECTIVE permissions for a project:
 * their global-role permissions (JWT) UNION the project's `my_permissions`
 * (global ∪ membership-role perms, computed by the backend). This lets a user
 * invited as a project admin/manager see the right controls even though their
 * global role is the read-only default.
 *
 * Wildcards are honored the same way the backend does: an exact match, `*:*`
 * (superadmin), or `<resource>:*` (e.g. `project:*` grants `project:manage_labor`).
 */
export function canOnProject(
  required: string,
  globalPerms: string[] | undefined | null,
  projectPerms: string[] | undefined | null
): boolean {
  const perms = new Set([...(globalPerms ?? []), ...(projectPerms ?? [])]);
  if (perms.has(required) || perms.has("*:*")) return true;
  const resource = required.split(":")[0];
  return perms.has(`${resource}:*`);
}
