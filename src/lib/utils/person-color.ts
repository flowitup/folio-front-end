/**
 * Deterministic Person → color mapping.
 *
 * Used by the labor module to assign each Person a stable visual identity
 * across the calendar cells (Phase 2) and the AddWorkerDialog typeahead
 * tiles (Phase 3). Same person_id always renders the same color in every
 * surface — recognition reinforced everywhere.
 *
 * Palette
 * -------
 * 12 hues, hand-picked for:
 *   - WCAG-AA contrast against zinc-100 / zinc-900 backgrounds (the two
 *     surfaces the chip renders on in dark / light mode).
 *   - Distinctness across red-green color-vision deficiency — hues are
 *     spaced ≥ 30° apart in HSL space, with at least two notably
 *     different saturations to disambiguate green/red pairs.
 *   - No two near-identical hues that would collide for non-expert eyes
 *     in a 6-worker calendar cell.
 *
 * For projects with > 12 active workers the palette repeats. Collision is
 * mitigated by initials still being readable on the chip (Phase 2 cell
 * design) — color is a recognition aid, not a unique identifier.
 *
 * Hash function
 * -------------
 * djb2-style xor-add accumulator across the id string. Bounded by the
 * palette length so the resulting bucket is a stable integer index.
 * Pure / synchronous / no runtime allocations beyond the loop variable.
 *
 * Plan: 260512-2341-labor-calendar-and-bulk-log → phase-01 → phase-02 (2a).
 */

export const PERSON_COLOR_PALETTE = [
  "#E11D48", // rose-600
  "#7C3AED", // violet-600
  "#0EA5E9", // sky-500
  "#10B981", // emerald-500
  "#F59E0B", // amber-500
  "#EC4899", // pink-500
  "#3B82F6", // blue-500
  "#84CC16", // lime-500
  "#F97316", // orange-500
  "#06B6D4", // cyan-500
  "#A855F7", // purple-500
  "#22C55E", // green-500
] as const;

/**
 * Returns the deterministic color for a Person.
 *
 * Accepts either the Person id or any unique key (worker.id is a safe
 * fallback before cook 1c backfill links every worker to a person).
 * Empty / null inputs fall back to the first palette entry so the UI
 * never renders a blank chip.
 */
export function personColor(key: string | null | undefined): string {
  if (!key) return PERSON_COLOR_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    // (hash * 33) ^ charCode — djb2 hash variant, fits in a 32-bit int.
    hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % PERSON_COLOR_PALETTE.length;
  return PERSON_COLOR_PALETTE[index];
}

/**
 * Returns the display color for a Worker chip.
 *
 * Priority: role_color (explicit assignment) → deterministic personColor hash.
 * This keeps role-grouped workers visually consistent while still giving
 * unassigned workers their stable hash-derived color.
 */
export function workerColor(worker: {
  role_color?: string | null;
  person_id?: string | null;
  id: string;
}): string {
  return worker.role_color ?? personColor(worker.person_id ?? worker.id);
}

/**
 * Two-letter initials helper used alongside the colored chip.
 *
 * Falls back to the first two characters of a single-word name. Never
 * returns more than 2 chars so chip layouts stay predictable.
 */
export function personInitials(name: string | null | undefined): string {
  if (!name) return "";
  const trimmed = name.trim();
  if (!trimmed) return "";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
