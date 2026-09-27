/**
 * Shared bits of the labor-role editors (the role picker on the labor page and
 * the Labor roles card under Settings › Company): error wording and the
 * update payload.
 */

import type { LaborRole, UpdateLaborRolePayload } from "@/types/labor-role";

/** Translator scoped to the `labor.role` namespace. */
type RoleTranslator = (key: string, values?: Record<string, string>) => string;

export type RoleMutation = "create" | "update" | "delete";

const FALLBACK_KEY: Record<RoleMutation, string> = {
  create: "createFailed",
  update: "updateFailed",
  delete: "deleteFailed",
};

/**
 * What to tell the user when a role mutation fails. Known codes get a
 * translated sentence; anything else keeps the backend's own message next to
 * the generic "failed" line, so a refusal the UI has no code for (a role that
 * cannot be deleted, say) still reaches the user in the backend's words.
 *
 * A 409 or 400 on DELETE cannot be a duplicate name or a bad form field, so on
 * delete those codes fall through to the backend's message as well.
 */
export function laborRoleErrorMessage(
  t: RoleTranslator,
  failure: { error: string; message?: string },
  mutation: RoleMutation,
): string {
  const fallback = t(FALLBACK_KEY[mutation]);
  const withDetail = failure.message ? `${fallback}: ${failure.message}` : fallback;
  switch (failure.error) {
    case "duplicate":
      return mutation === "delete" ? withDetail : t("duplicateName");
    case "validation":
      return mutation === "delete" ? withDetail : t("errors.invalid");
    case "forbidden":
      return t("errors.forbidden");
    case "notFound":
      return t("errors.notFound");
    case "rateLimited":
      return t("errors.rateLimited");
    default:
      return withDetail;
  }
}

/**
 * The PATCH body for an edit, or null when nothing changed.
 *
 * `shownName` is what the form was pre-filled with — for a seeded default role
 * that is the viewer's translated label, not the stored (Vietnamese) name — so
 * the name is only sent when the user actually typed a different one. A
 * color-only change therefore never renames "Thợ chính" to "Master craftsman".
 */
export function buildLaborRoleUpdate(
  role: LaborRole,
  shownName: string,
  values: { name: string; color: string },
): UpdateLaborRolePayload | null {
  const payload: UpdateLaborRolePayload = {};
  const name = values.name.trim();
  if (name && name !== shownName.trim()) payload.name = name;
  if (values.color && values.color.toLowerCase() !== role.color.toLowerCase()) {
    payload.color = values.color;
  }
  return payload.name === undefined && payload.color === undefined ? null : payload;
}
