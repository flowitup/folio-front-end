/**
 * Browser-side download of a billing document's PDF / XLSX, shared by the
 * preview dialog, the list's actions menu and the document form.
 *
 * Each render used to be fetched separately (preview, then the page's
 * "Télécharger PDF", then the form's), so looking at a few quotes spent the
 * per-user render quota and the 3rd or 4th one failed. The bytes are now
 * kept for the session, keyed by document id + updated_at + format: an
 * unchanged document is never rendered twice, and an edit (new updated_at)
 * gets a fresh render.
 */

import { env } from "@/lib/config/env";
import { fetchWithRefresh } from "@/lib/api/refresh";
import { parseFilenameFromContentDisposition } from "@/lib/api/_helpers/content-disposition";
import { retryAfterOfResponse } from "@/lib/api/rate-limit";

export type BillingFileFormat = "pdf" | "xlsx";

export type BillingFileTarget = {
  id: string;
  document_number: string;
  /** When known, the cache entry is tied to this version of the document. */
  updated_at?: string | null;
};

export type BillingFile = { bytes: ArrayBuffer; filename: string };

/** A failed download, with the HTTP status and (for a 429) the wait in seconds. */
export class BillingFileError extends Error {
  constructor(
    message: string,
    public status: number | null,
    public retryAfter: number | null = null,
  ) {
    super(message);
    this.name = "BillingFileError";
  }
}

const MAX_ENTRIES = 12;
/** Without a version to key on, a cached render is reused for a short while only. */
const UNVERSIONED_TTL_MS = 60_000;

type Entry = { promise: Promise<BillingFile>; at: number; versioned: boolean };
const cache = new Map<string, Entry>();

function cacheKey(target: BillingFileTarget, format: BillingFileFormat): string {
  return `${target.id}:${target.updated_at ?? ""}:${format}`;
}

/** Forget every cached render (tests, sign-out). */
export function clearBillingFileCache(): void {
  cache.clear();
}

async function download(target: BillingFileTarget, format: BillingFileFormat): Promise<BillingFile> {
  let response: Response;
  try {
    response = await fetchWithRefresh(
      `${env.apiBaseUrl}/billing-documents/${encodeURIComponent(target.id)}/${format}`,
      { method: "GET" },
    );
  } catch (err) {
    throw new BillingFileError(`Network error: ${String(err)}`, null);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new BillingFileError(
      `HTTP ${response.status}`,
      response.status,
      response.status === 429 ? retryAfterOfResponse(response, body) : null,
    );
  }
  const filename = parseFilenameFromContentDisposition(
    response.headers.get("Content-Disposition"),
    `${target.document_number}.${format}`,
  );
  const bytes = await response.arrayBuffer();
  return { bytes, filename };
}

/**
 * The document's file, from the session cache when this version was already
 * fetched (concurrent callers share one request). Failures are not cached.
 */
export function fetchBillingFile(
  target: BillingFileTarget,
  format: BillingFileFormat,
): Promise<BillingFile> {
  const key = cacheKey(target, format);
  const hit = cache.get(key);
  if (hit && (hit.versioned || Date.now() - hit.at < UNVERSIONED_TTL_MS)) {
    // Refresh recency for the LRU order
    cache.delete(key);
    cache.set(key, hit);
    return hit.promise;
  }
  const promise = download(target, format);
  const entry: Entry = { promise, at: Date.now(), versioned: !!target.updated_at };
  cache.set(key, entry);
  promise.catch(() => {
    if (cache.get(key) === entry) cache.delete(key);
  });
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
  return promise;
}

export function billingFileBlob(file: BillingFile, format: BillingFileFormat): Blob {
  return new Blob([file.bytes], {
    type:
      format === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
