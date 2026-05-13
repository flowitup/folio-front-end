/**
 * Resolve a Facebook profile URL (or bare username) to the unauthenticated
 * Graph picture endpoint that returns the public profile photo.
 *
 * Accepts:
 *   - https://www.facebook.com/sophie.moreau
 *   - https://facebook.com/sophie.moreau/
 *   - https://www.facebook.com/profile.php?id=100012345678
 *   - sophie.moreau (bare username)
 *
 * Returns the graph URL or null if the input doesn't look like a Facebook
 * reference. Empty/whitespace input returns null so callers can clear an
 * existing avatar by submitting "".
 */
export function resolveFacebookAvatarUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  // Numeric profile.php?id=... → use the numeric id directly.
  const idMatch = raw.match(/[?&]id=(\d+)/);
  if (idMatch) {
    return `https://graph.facebook.com/${idMatch[1]}/picture?type=large`;
  }

  // facebook.com URL → take the first path segment after the host.
  const urlMatch = raw.match(/(?:facebook\.com|fb\.com)\/([A-Za-z0-9.\-_]+)/i);
  if (urlMatch) {
    return `https://graph.facebook.com/${urlMatch[1]}/picture?type=large`;
  }

  // Bare username — allow letters, digits, dot, dash, underscore.
  if (/^[A-Za-z0-9.\-_]+$/.test(raw)) {
    return `https://graph.facebook.com/${raw}/picture?type=large`;
  }

  // Already a graph.facebook.com .../picture URL — pass through.
  if (/^https?:\/\/graph\.facebook\.com\/.+\/picture/.test(raw)) {
    return raw;
  }

  return null;
}
