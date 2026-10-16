import type { User } from "@/lib/auth/types";
import { loginPathFor } from "@/lib/auth/callback-url";

/**
 * Shortest gap between two automatic re-reads of the user and the project list (window focus,
 * tab shown again, client navigation). The same 30 s the mobile app's queries stay fresh: quick
 * back-and-forth costs nothing, and a change made by someone else shows up on the next move.
 */
export const AUTO_REFRESH_MIN_GAP_MS = 30_000;

/** After a 403 the permissions are known to be stale: re-read sooner, but never in a loop. */
export const DENIED_REFRESH_MIN_GAP_MS = 5_000;

/**
 * What decides what the user may see and do: global permissions plus, per company, the role,
 * which one is primary and the sections it hides. Two users with the same signature render the same
 * navigation, so the server-rendered layout (billing entry, gates) only needs a refresh when
 * it changes. Order-insensitive: the API may list companies or permissions in any order.
 */
export function accessSignature(user: User | null | undefined): string {
  if (!user) return "";
  const companies = (user.companies ?? [])
    .map((company) =>
      [
        company.id,
        company.role ?? "",
        company.is_primary ? "1" : "0",
        [...(company.hidden_sections ?? [])].sort().join(","),
      ].join(":")
    )
    .sort();
  return JSON.stringify([[...(user.permissions ?? [])].sort(), companies]);
}

/**
 * Throttle for the automatic re-reads: `tryStart(gap)` says whether a run may start now (none in
 * flight, and at least `gap` ms since the previous one started), and if so records it.
 */
export function createRefreshThrottle(now: () => number = Date.now) {
  // The page was rendered from fresh data a moment ago.
  let lastStart = now();
  let inFlight = false;
  return {
    tryStart(minGapMs: number): boolean {
      const at = now();
      if (inFlight || at - lastStart < minGapMs) return false;
      inFlight = true;
      lastStart = at;
      return true;
    },
    finish(): void {
      inFlight = false;
    },
  };
}

/** Sign-in page for a session that ended under the user (deactivated, revoked): says why, and
 * comes back to the page they were on. */
export function sessionEndedLoginPath(currentPath: string, locale: string): string {
  const path = loginPathFor(currentPath, locale);
  return `${path}${path.includes("?") ? "&" : "?"}reason=session_ended`;
}
