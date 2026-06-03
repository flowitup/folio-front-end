/**
 * Library product category constants.
 * Slugs are canonical — order here drives filter dropdown ordering.
 * Labels live in i18n (bibliotheque.categories.<slug>) — NOT hardcoded here.
 */

import type { useTranslations } from "next-intl";

/** Canonical slug order for the 16 library product categories. */
export const LIBRARY_CATEGORY_SLUGS = [
  "terrasse_jardin",
  "revetement_sol_mur_peinture",
  "chauffage_clim_ventilation",
  "salle_de_bains",
  "meuble_rangement",
  "cuisine",
  "luminaire",
  "decoration",
  "menuiserie",
  "materiaux_construction",
  "electricite_domotique",
  "outillage",
  "plomberie",
  "quincaillerie",
  "droguerie",
  "autre",
] as const;

export type LibraryCategorySlug = (typeof LIBRARY_CATEGORY_SLUGS)[number];

/** Type-guard: returns true if v is one of the 16 canonical slugs. */
export function isLibraryCategorySlug(v: string): v is LibraryCategorySlug {
  return (LIBRARY_CATEGORY_SLUGS as readonly string[]).includes(v);
}

type Translator = ReturnType<typeof useTranslations>;

/**
 * Converts a raw category value to a human-readable label via i18n.
 *
 * - Known slug       → t("categories.<slug>")
 * - null / ""        → t("uncategorized")
 * - Unknown non-null → raw value as-is (defensive: shouldn't happen post-backfill)
 *
 * `t` should be `useTranslations("bibliotheque")` or equivalent server-side function.
 */
export function localizeCategory(
  value: string | null | undefined,
  t: Translator
): string {
  if (!value) return t("uncategorized");
  if (isLibraryCategorySlug(value)) return t(`categories.${value}`);
  // Legacy / unknown slug — return raw to avoid data loss
  return value;
}
