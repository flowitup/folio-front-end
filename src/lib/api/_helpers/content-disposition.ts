/**
 * Parse a filename out of a Content-Disposition header.
 *
 * Supports RFC 6266 `filename*=UTF-8''<percent-encoded>` (preferred) and the
 * plain `filename="..."` form. Returns `fallback` when neither is present or
 * the percent-encoded form fails to decode.
 */
export function parseFilenameFromContentDisposition(
  header: string | null,
  fallback: string,
): string {
  if (!header) return fallback;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star) {
    try {
      return decodeURIComponent(star[1]);
    } catch {
      // fall through
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? plain[1] : fallback;
}
