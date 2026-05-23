/**
 * Presigned URL upload helpers — browser uploads directly to S3/MinIO,
 * bypassing Cloudflare's 100 MB body limit.
 *
 * Flow: presign → PUT to S3 → confirm → DB row created.
 */

import { getCsrfToken } from "@/lib/api/http";
import { refreshAccessTokenViaCookie } from "@/lib/api/refresh";
import { env } from "@/lib/config/env";
import type { ProjectDocument } from "@/lib/api/project-documents";

// ---- Types ----

export type PresignResponse = {
  presigned_url: string;
  storage_key: string;
  doc_id: string;
};

export type ProgressCallback = (progress: number) => void;

// ---- API helpers ----

/**
 * Request a presigned PUT URL from the backend.
 * Retries once on 401 after refreshing the access token.
 */
export async function requestPresignedUrl(
  projectId: string,
  file: File,
): Promise<PresignResponse> {
  async function doRequest(): Promise<Response> {
    const csrf = getCsrfToken();
    return fetch(
      `${env.apiBaseUrl}/projects/${encodeURIComponent(projectId)}/documents/presign`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(csrf ? { "X-CSRF-TOKEN": csrf } : {}),
        },
        body: JSON.stringify({
          filename: file.name,
          content_type: file.type || "application/octet-stream",
          size_bytes: file.size,
        }),
      },
    );
  }

  let res = await doRequest();

  // Single 401 retry with token refresh
  if (res.status === 401) {
    const refreshed = await refreshAccessTokenViaCookie();
    if (refreshed) {
      res = await doRequest();
    }
  }

  if (!res.ok) {
    throw new Error(`presign:${res.status}`);
  }
  return res.json();
}

/**
 * Confirm the presigned upload — backend verifies S3 object exists and
 * persists the DB row.
 */
export async function confirmUpload(
  projectId: string,
  presign: PresignResponse,
  file: File,
): Promise<ProjectDocument> {
  const csrf = getCsrfToken();
  const res = await fetch(
    `${env.apiBaseUrl}/projects/${encodeURIComponent(projectId)}/documents/confirm`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(csrf ? { "X-CSRF-TOKEN": csrf } : {}),
      },
      body: JSON.stringify({
        doc_id: presign.doc_id,
        storage_key: presign.storage_key,
        filename: file.name,
        content_type: file.type || "application/octet-stream",
        size_bytes: file.size,
      }),
    },
  );

  if (!res.ok) {
    throw new Error(`confirm:${res.status}`);
  }
  return res.json();
}

// ---- S3 PUT via XHR (for progress tracking) ----

/**
 * PUT file directly to S3/MinIO via presigned URL.
 * No cookies/CSRF — auth is embedded in the URL query string.
 * Reports progress via callback (0..0.95 range — last 5% reserved for confirm).
 */
export function putToPresignedUrl(
  url: string,
  file: File,
  contentType: string,
  onProgress: ProgressCallback,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    // No credentials — presigned URL carries auth in query params
    // No CSRF — not going through Flask

    // Stall detection: if progress hasn't changed for 60s, abort.
    let stallTimer = setTimeout(abortOnStall, 60_000);

    function resetStallTimer() {
      clearTimeout(stallTimer);
      stallTimer = setTimeout(abortOnStall, 60_000);
    }

    function abortOnStall() {
      if (xhr.readyState !== XMLHttpRequest.DONE) {
        xhr.abort();
      }
    }

    function clearStallTimer() {
      clearTimeout(stallTimer);
    }

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        // Map to 0–0.95 range (last 5% reserved for confirm step)
        const progress = (e.loaded / e.total) * 0.95;
        onProgress(progress);
        resetStallTimer();
      }
    };

    xhr.onload = () => {
      clearStallTimer();
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`s3put:${xhr.status}`));
      }
    };

    xhr.onerror = () => {
      clearStallTimer();
      reject(new Error("s3put:network"));
    };

    xhr.onabort = () => {
      clearStallTimer();
      reject(new Error("s3put:stall"));
    };

    xhr.send(file);
  });
}
