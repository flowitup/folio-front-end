/**
 * Company join-code helpers (client-safe, pure).
 *
 * The backend issues 8-character codes from an unambiguous alphabet (no 0/O/1/I);
 * the mobile app displays them as XXXX-XXXX. Users may paste either form, in any case.
 */

/** Uppercase the code and drop the separators/whitespace people type or paste. */
export function normalizeJoinCode(raw: string): string {
  return raw.toUpperCase().replace(/[\s-]/g, "");
}

/** XXXXXXXX → XXXX-XXXX for display; shorter/longer values are returned untouched. */
export function formatJoinCode(code: string): string {
  const normalized = normalizeJoinCode(code);
  return normalized.length === 8
    ? `${normalized.slice(0, 4)}-${normalized.slice(4)}`
    : normalized;
}
