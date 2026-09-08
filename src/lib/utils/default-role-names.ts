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

/**
 * Legacy fallback: the two default roles were seeded once, globally, with
 * these fixed UUIDs before the Phase 2 per-company backfill. Any row that
 * predates the backfill (or a company created before the fix landed) may
 * still carry one of these ids without a resolvable slug/name match.
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
  const slug = role.slug ?? (role.name ? SEED_ROLE_NAME_TO_SLUG[role.name] : undefined);
  if (slug && SLUG_TO_I18N_KEY[slug]) return SLUG_TO_I18N_KEY[slug];
  if (role.id && DEFAULT_ROLE_I18N_KEYS[role.id]) return DEFAULT_ROLE_I18N_KEYS[role.id];
  return null;
}
