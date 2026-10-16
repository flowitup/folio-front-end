/**
 * Navigate to an in-app path that may carry a `#hash` (e.g. `/fr/settings#company`).
 *
 * `router.push` to the page you are already on only changes the hash, and Next fires no
 * `hashchange` for it, so a page that picks its tab from the hash (Settings) never
 * switches. When the path is the current page, set the hash ourselves and announce it.
 */
export function pushPath(router: { push: (href: string) => void }, path: string): void {
  const hashAt = path.indexOf("#");
  if (hashAt >= 0 && typeof window !== "undefined") {
    const pathname = path.slice(0, hashAt);
    const hash = path.slice(hashAt);
    if (window.location.pathname === pathname) {
      if (window.location.hash !== hash) {
        window.history.pushState(null, "", `${pathname}${window.location.search}${hash}`);
      }
      window.dispatchEvent(new HashChangeEvent("hashchange"));
      return;
    }
  }
  router.push(path);
}
