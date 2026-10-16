/**
 * Default labor role → i18n key resolution.
 *
 * roles-permissions-redesign (Phase 2): `labor_roles` moved from a single
 * global seed to one roster seeded per company (`SeedDefaultLaborRolesUseCase`,
 * mirrored from `migrations/versions/f2a3b4c5d6e7_add_labor_roles.py`), so the
 * two default roles no longer share a single fixed UUID across every company
 * — each company gets its own row with its own id. `labor_roles.slug` (e.g.
 * "tho_chinh") gives a stable cross-company key; it's typed optional on
 * `LaborRole` (types/labor-role.ts) since not every environment's
 * `GET /labor/roles` may populate it yet — falls back to the seed's literal
 * (locale-invariant, Vietnamese) name, which is exactly what the slug is
 * deterministically derived from.
 *
 * Resolution order:
 *   1. `slug` on the role/worker, when the backend sends it.
 *   2. The literal seed name. Companies created before default roles were
 *      localized store "Thợ chính" / "Thợ phụ"; newer ones store them in their
 *      creator's language ("Ouvrier principal" / "Ouvrier auxiliaire",
 *      "Lead worker" / "Assistant worker"). Every one of those is a default
 *      name, shown translated in the viewer's language.
 *   3. The legacy fixed-UUID map (pre-Phase-2 unbackfilled rows).
 *   4. null — caller falls back to the role's own (unlocalized) name field.
 *
 * A seeded role can be renamed (Settings › Company › Labor roles, or the role
 * picker). The rename keeps its slug and id, so whichever of 1–3 matched, a
 * stored name that is no longer the seed name means the company chose its own
 * — that name is shown, not the locale's default label. A role with no name
 * at hand (a worker row without `role_name`) still resolves.
 */

/**
 * Default names a seed role can be stored with (vi / fr / en), per slug. Mirrors
 * DEFAULT_ROLE_LABELS in the back end's app/application/labor/default_role_names.py.
 */
const SEED_NAMES_BY_SLUG: Record<string, string[]> = {
  tho_chinh: ["Thợ chính", "Ouvrier principal", "Lead worker"],
  tho_phu: ["Thợ phụ", "Ouvrier auxiliaire", "Assistant worker"],
};

/** Vietnamese names can arrive composed or decomposed, in any case; compare them folded. */
const foldName = (name: string): string => name.normalize("NFC").trim().toLocaleLowerCase();

/** Default name (folded, any language) → stable slug. */
const SEED_ROLE_NAME_TO_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(SEED_NAMES_BY_SLUG).flatMap(([slug, names]) =>
    names.map((name) => [foldName(name), slug]),
  ),
);

/** slug → i18n message key under the `labor.roles` namespace. */
const SLUG_TO_I18N_KEY: Record<string, string> = {
  tho_chinh: "masterCraftsman",
  tho_phu: "assistant",
};

/** i18n key → the default names it labels, for spotting a renamed seed role. */
const I18N_KEY_TO_SEED_NAMES: Record<string, string[]> = Object.fromEntries(
  Object.entries(SEED_NAMES_BY_SLUG).map(([slug, names]) => [
    SLUG_TO_I18N_KEY[slug],
    names.map(foldName),
  ]),
);

/**
 * Legacy fallback: the two default roles were seeded once, globally, with
 * these fixed UUIDs before the Phase 2 per-company backfill. Any row that
 * predates the backfill (or a company created before the fix landed) may
 * still carry one of these ids without a slug — and a worker row may carry
 * the id without the role's name.
 */
export const DEFAULT_ROLE_I18N_KEYS: Record<string, string> = {
  "b08f0bdb-9e78-40ca-aca9-96016de45c7c": "masterCraftsman",
  "de417d58-3d38-4658-a5f7-02b51fb749fc": "assistant",
};

export interface ResolvableRole {
  id?: string | null;
  name?: string | null;
  slug?: string | null;
}

/**
 * Resolve the i18n message key (under `labor.roles.*`) for a default labor
 * role, or null when the role is user-created (display its literal name).
 */
export function resolveDefaultRoleI18nKey(role: ResolvableRole): string | null {
  const slug =
    role.slug ?? (role.name ? SEED_ROLE_NAME_TO_SLUG[foldName(role.name)] : undefined);
  const key =
    (slug ? SLUG_TO_I18N_KEY[slug] : undefined) ??
    (role.id ? DEFAULT_ROLE_I18N_KEYS[role.id] : undefined);
  if (!key) return null;
  const renamed = !!role.name && !I18N_KEY_TO_SEED_NAMES[key].includes(foldName(role.name));
  return renamed ? null : key;
}

/**
 * Display label of a labor role in the viewer's language: a default role's
 * translation (`translate` receives its key under `labor.role.defaults`), else
 * the stored name.
 */
export function laborRoleDisplayName(
  role: ResolvableRole & { name: string },
  translate: (key: string) => string,
): string {
  const key = resolveDefaultRoleI18nKey(role);
  return key ? translate(key) : role.name;
}

/** Roles sorted by the label the viewer sees (default roles are stored in Vietnamese). */
export function sortRolesByLabel<T extends ResolvableRole & { name: string }>(
  roles: T[],
  translate: (key: string) => string,
  locale?: string,
): T[] {
  return [...roles].sort((a, b) =>
    laborRoleDisplayName(a, translate).localeCompare(
      laborRoleDisplayName(b, translate),
      locale,
      { sensitivity: "base" },
    ),
  );
}
