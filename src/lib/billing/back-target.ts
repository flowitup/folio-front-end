/**
 * Where a billing document's back arrow (and Cancel) returns to. A document
 * opened from a project's Facturation tab carries `?back=project:<id>` and
 * returns there; otherwise it returns to the company-wide list. (`?from=` is
 * already taken by "create from an existing document".)
 */

import { useSyncExternalStore } from "react";

const PROJECT_BACK = /^project:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/** The query string a project's billing tab adds to its document links. */
export function projectBackQuery(projectId: string): string {
  return `back=${encodeURIComponent(`project:${projectId}`)}`;
}

/** Only a project id is honoured, so the parameter cannot send anyone off-site. */
export function billingBackPath(back: string | null | undefined, listPath: string, locale: string): string {
  const match = back ? PROJECT_BACK.exec(back) : null;
  return match ? `/${locale}/projects/${match[1]}/billing` : listPath;
}

const noopSubscribe = () => () => {};

/**
 * Read from the address bar once hydrated (the arrow is only clicked then):
 * no Suspense boundary needed, and the server render uses the list path.
 */
export function useBillingBackPath(listPath: string, locale: string): string {
  const back = useSyncExternalStore(
    noopSubscribe,
    () => new URLSearchParams(window.location.search).get("back"),
    () => null
  );
  return billingBackPath(back, listPath, locale);
}
