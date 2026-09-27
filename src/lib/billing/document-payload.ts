/**
 * Helpers that turn billing data read from the API back into the shape the
 * create / update endpoints accept.
 *
 * The API returns more than it accepts: each line carries its computed
 * total_ht / total_tva / total_ttc, and the request schemas reject unknown
 * fields (extra="forbid"). Dates may come back as RFC 1123 strings
 * ("Sun, 27 Sep 2026 00:00:00 GMT") while the requests and <input type="date">
 * both need YYYY-MM-DD.
 */

const ISO_DATE = /^(\d{4}-\d{2}-\d{2})(?:$|T)/;

/**
 * Normalise an API date to YYYY-MM-DD, or null when absent or unparseable.
 *
 * Accepts YYYY-MM-DD, full ISO timestamps and RFC 1123 strings. A plain
 * calendar date is sent by the API as midnight GMT, so the UTC date is the
 * stored date whatever the viewer's timezone.
 */
export function toIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const iso = ISO_DATE.exec(value);
  if (iso) return iso[1];
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}
