/** Note length limits, the same as the API (notes/schemas.py) and the mobile app. */
export const NOTE_TITLE_MAX = 200;
export const NOTE_BODY_MAX = 2000;

/** "1850 / 2000" once a field is within 10% of its limit, else null. */
export function noteCharCount(length: number, max: number): string | null {
  return length >= max * 0.9 ? `${length} / ${max}` : null;
}
