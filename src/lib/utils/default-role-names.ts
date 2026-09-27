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
 *   2. The literal seed name ("Thợ chính" / "Thợ phụ") — always Vietnamese in
 *      the DB regardless of company or the viewer's locale.
 *   3. The legacy fixed-UUID map (pre-Phase-2 unbackfilled rows).
 *   4. null — caller falls back to the role's own (unlocalized) name field.
 *
 * A seeded role can be renamed (Settings › Company › Labor roles, or the role
 * picker). The rename keeps its slug and id, so whichever of 1–3 matched, a
 * stored name that is no longer the seed name means the company chose its own
 * — that name is shown, not the locale's default label. A role with no name
 * at hand (a worker row without `role_name`) still resolves.
 */

/** Seed name (as stored, always Vietnamese) → stable slug. Mirrors DEFAULT_ROLES in seed_default_labor_roles.py. */
const SEED_ROLE_NAME_TO_SLUG: Record<string, string> = {
  "Thợ chính": "tho_chinh",
  "Thợ phụ": "tho_phu",
};

/** slug → i18n message key under the `labor.roles` namespace. */
const SLUG_TO_I18N_KEY: Record<string, string> = {
  tho_chinh: "masterCraftsman",
  tho_phu: "assistant",
};

/** i18n key → the seed name it labels, for spotting a renamed seed role. */
const I18N_KEY_TO_SEED_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(SEED_ROLE_NAME_TO_SLUG).map(([name, slug]) => [SLUG_TO_I18N_KEY[slug], name]),
);

/** Vietnamese names can arrive composed or decomposed; compare them composed. */
const normalizeName = (name: string): string => name.normalize("NFC").trim();

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
    role.slug ?? (role.name ? SEED_ROLE_NAME_TO_SLUG[normalizeName(role.name)] : undefined);
  const key =
    (slug ? SLUG_TO_I18N_KEY[slug] : undefined) ??
    (role.id ? DEFAULT_ROLE_I18N_KEYS[role.id] : undefined);
  if (!key) return null;
  const renamed =
    !!role.name && normalizeName(role.name) !== normalizeName(I18N_KEY_TO_SEED_NAME[key]);
  return renamed ? null : key;
}
