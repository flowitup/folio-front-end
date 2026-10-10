/**
 * A success toast that survives a full page load.
 *
 * Some actions end with `window.location.assign` to drop every bit of client
 * state; a toast shown just before it disappears with the page. Queue it here
 * instead and <FlashToast /> shows it once the next page has loaded.
 */

const KEY = "folio:flash-toast";

export function queueFlashToast(message: string): void {
  try {
    sessionStorage.setItem(KEY, message);
  } catch {
    // Storage blocked (private mode): the toast is lost, the navigation still happens.
  }
}

/** The queued message, removed so it shows only once. */
export function takeFlashToast(): string | null {
  try {
    const message = sessionStorage.getItem(KEY);
    if (message !== null) sessionStorage.removeItem(KEY);
    return message;
  } catch {
    return null;
  }
}
