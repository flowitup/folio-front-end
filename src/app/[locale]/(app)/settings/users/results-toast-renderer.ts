/**
 * Bulk-add results toast renderer
 * Groups BulkAddResultItem[] by status and fires appropriate Sonner toasts.
 * Pure helper — no React, no hooks. Accepts a `t` translation function
 * so the caller controls the i18n namespace.
 */

import { toast } from "sonner";
import type { BulkAddResultItem } from "@/lib/api/admin";

type TranslateFn = (
  key: string,
  // next-intl Translator values must be string | number | Date
  values?: Record<string, string | number | Date>
) => string;

/**
 * Fire one toast per status group present in `results`.
 * @param results - array returned by bulkAddMembershipsAction
 * @param t       - bound translation function (useTranslations('admin.bulkAdd.toast'))
 */
export function renderBulkAddResultsToasts(
  results: BulkAddResultItem[],
  t: TranslateFn
): void {
  const added = results.filter((r) => r.status === "added");
  const sameRole = results.filter((r) => r.status === "already_member_same_role");
  const diffRole = results.filter(
    (r) => r.status === "already_member_different_role"
  );
  const notFound = results.filter((r) => r.status === "project_not_found");

  if (added.length > 0) {
    toast.success(t("added", { count: added.length }));
  }
  if (sameRole.length > 0) {
    toast.info(t("alreadyMember", { count: sameRole.length }));
  }
  if (diffRole.length > 0) {
    toast.warning(t("differentRole", { count: diffRole.length }));
  }
  if (notFound.length > 0) {
    toast.error(t("notFound", { count: notFound.length }));
  }
}
