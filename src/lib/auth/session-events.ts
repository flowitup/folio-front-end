/**
 * Browser-wide signals about the signed-in session, raised by the API client and handled by
 * `SessionFreshness` (mounted once in the app layout):
 *
 * - `access-denied`: the API answered 403. The session's permissions or project list may be
 *   stale (another admin changed this user's role, or removed them from a project), so the
 *   user and the project list are re-read.
 * - `session-ended`: a 401 the refresh token could not fix (the refresh itself was refused:
 *   account deactivated, session revoked). The user is sent to sign in with an explanation.
 *
 * Plain window events, so `lib/api/http.ts` stays free of React and of the contexts.
 */

export type SessionEvent = "access-denied" | "session-ended";

const EVENT_PREFIX = "folio:session:";

export function emitSessionEvent(event: SessionEvent): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EVENT_PREFIX + event));
}

/** Subscribes to one session event; returns the unsubscribe function. */
export function onSessionEvent(event: SessionEvent, handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const name = EVENT_PREFIX + event;
  window.addEventListener(name, handler);
  return () => window.removeEventListener(name, handler);
}
