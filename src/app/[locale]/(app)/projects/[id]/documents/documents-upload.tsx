"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Upload, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { env } from "@/lib/config/env";
import { getApiAccessToken, getCsrfToken } from "@/lib/api/http";
import { refreshAccessTokenViaCookie } from "@/lib/api/refresh";
import type { ProjectDocument } from "@/lib/api/project-documents";

// ---- Constants ----

const MAX_SIZE_BYTES = 26_214_400; // 25 MiB

const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".docx",
  ".xlsx",
  ".dwg",
  ".txt",
] as const;

// ---- Types ----

type UploadErrorKind =
  | "oversize"
  | "unsupported"
  | "network"
  | "rateLimited"
  | "server"
  | "forbidden";

type UploadJob = {
  id: string;
  file: File;
  status: "queued" | "uploading" | "done" | "failed";
  progress: number; // 0..1
  error?: { kind: UploadErrorKind; message?: string };
  doc?: ProjectDocument;
};

type Props = {
  projectId: string;
  onUploaded: (doc: ProjectDocument) => void;
};

// ---- Helpers ----

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot === -1) return "";
  return filename.slice(dot).toLowerCase();
}

// ---- Component ----

export function DocumentsUpload({ projectId, onUploaded }: Props) {
  const t = useTranslations("documents.upload");
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [jobs, setJobs] = useState<Record<string, UploadJob>>({});

  // Merge partial update into a single job
  function updateJob(jobId: string, patch: Partial<UploadJob>) {
    setJobs((prev) => {
      const existing = prev[jobId];
      if (!existing) return prev;
      return { ...prev, [jobId]: { ...existing, ...patch } };
    });
  }

  // Schedule removal of a done job after 3s
  function scheduleDoneCleanup(jobId: string) {
    setTimeout(() => {
      setJobs((prev) => {
        const next = { ...prev };
        delete next[jobId];
        return next;
      });
    }, 3000);
  }

  // Send a single XHR upload with the given bearer token.
  // Returns "retry_401" when the server responds 401 so the caller can refresh
  // and call once more; returns void for all other outcomes (job already updated).
  function sendXhr(
    file: File,
    jobId: string,
    token: string,
  ): Promise<"retry_401" | void> {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      const url = `${env.apiBaseUrl}/projects/${encodeURIComponent(projectId)}/documents`;
      xhr.open("POST", url);

      xhr.setRequestHeader("Authorization", `Bearer ${token}`);

      // CSRF defense-in-depth for mutations
      const csrf = getCsrfToken();
      if (csrf) xhr.setRequestHeader("X-CSRF-TOKEN", csrf);

      // Ensure cookies are sent for same-origin session fallback
      xhr.withCredentials = true;

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          updateJob(jobId, { status: "uploading", progress: e.loaded / e.total });
        }
      };

      xhr.onload = () => {
        if (xhr.status === 201) {
          let doc: ProjectDocument;
          try {
            doc = JSON.parse(xhr.responseText) as ProjectDocument;
          } catch {
            updateJob(jobId, {
              status: "failed",
              error: { kind: "server", message: "Invalid response from server" },
            });
            resolve();
            return;
          }
          updateJob(jobId, { status: "done", progress: 1, doc });
          onUploaded(doc);
          scheduleDoneCleanup(jobId);
          resolve();
        } else if (xhr.status === 401) {
          // Signal caller to refresh + retry once
          resolve("retry_401");
        } else if (xhr.status === 413) {
          updateJob(jobId, { status: "failed", error: { kind: "oversize" } });
          resolve();
        } else if (xhr.status === 415) {
          updateJob(jobId, { status: "failed", error: { kind: "unsupported" } });
          resolve();
        } else if (xhr.status === 429) {
          updateJob(jobId, { status: "failed", error: { kind: "rateLimited" } });
          resolve();
        } else if (xhr.status === 403) {
          updateJob(jobId, { status: "failed", error: { kind: "forbidden" } });
          resolve();
        } else {
          updateJob(jobId, {
            status: "failed",
            error: { kind: "server", message: `HTTP ${xhr.status}` },
          });
          resolve();
        }
      };

      xhr.onerror = () => {
        updateJob(jobId, { status: "failed", error: { kind: "network" } });
        resolve();
      };

      xhr.onabort = () => {
        updateJob(jobId, { status: "failed", error: { kind: "network" } });
        resolve();
      };

      const fd = new FormData();
      fd.append("file", file);
      xhr.send(fd);
    });
  }

  async function uploadOne(file: File, jobId: string) {
    // Bootstrap token: if no in-memory token (fresh page load), try refresh via
    // cookie before sending. Mirrors the fix applied to the blob helper (H2).
    let token = getApiAccessToken();
    if (!token) token = await refreshAccessTokenViaCookie();
    if (!token) {
      updateJob(jobId, { status: "failed", error: { kind: "forbidden" } });
      return;
    }

    const outcome = await sendXhr(file, jobId, token);

    if (outcome === "retry_401") {
      // Token expired mid-upload: refresh once and retry
      const fresh = await refreshAccessTokenViaCookie();
      if (fresh) {
        await sendXhr(file, jobId, fresh);
      } else {
        updateJob(jobId, { status: "failed", error: { kind: "forbidden" } });
      }
    }
  }

  function handleFiles(files: File[]) {
    const newJobs: Record<string, UploadJob> = {};

    for (const file of files) {
      const jobId = crypto.randomUUID();
      const ext = getExtension(file.name);

      // Client-side validation: extension
      if (!ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])) {
        newJobs[jobId] = {
          id: jobId,
          file,
          status: "failed",
          progress: 0,
          error: { kind: "unsupported" },
        };
        continue;
      }

      // Client-side validation: size
      if (file.size > MAX_SIZE_BYTES) {
        newJobs[jobId] = {
          id: jobId,
          file,
          status: "failed",
          progress: 0,
          error: { kind: "oversize" },
        };
        continue;
      }

      newJobs[jobId] = {
        id: jobId,
        file,
        status: "queued",
        progress: 0,
      };
    }

    setJobs((prev) => ({ ...prev, ...newJobs }));

    // Kick off uploads for all valid queued jobs (fire-and-forget; state
    // updates happen inside uploadOne / sendXhr via updateJob)
    for (const [jobId, job] of Object.entries(newJobs)) {
      if (job.status === "queued") {
        void uploadOne(job.file, jobId);
      }
    }
  }

  function dismissJob(jobId: string) {
    setJobs((prev) => {
      const next = { ...prev };
      delete next[jobId];
      return next;
    });
  }

  function getErrorText(kind: UploadErrorKind): string {
    switch (kind) {
      case "oversize":
        return t("errorOversize");
      case "unsupported":
        return t("errorUnsupported");
      case "network":
        return t("errorNetwork");
      case "rateLimited":
        return t("errorRateLimited");
      case "forbidden":
        return t("errorForbidden");
      case "server":
        return t("errorServer");
    }
  }

  const jobList = Object.values(jobs);

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        role="region"
        aria-label={t("dragHere")}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragOver(false);
        }}
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(Array.from(e.dataTransfer.files));
        }}
        className={cn(
          "rounded-md border-2 border-dashed p-8 text-center transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30"
        )}
      >
        <Upload className="mx-auto mb-3 size-6 text-muted-foreground" aria-hidden />
        <p className="mb-3 text-sm text-muted-foreground">{t("dragHere")}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
        >
          {t("ctaPick")}
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">{t("supportedTypes")}</p>

        {/* Hidden file input */}
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          accept={ALLOWED_EXTENSIONS.join(",")}
          onChange={(e) => {
            handleFiles(Array.from(e.target.files ?? []));
            // Reset so the same file can be re-selected after dismissing a failed job
            e.target.value = "";
          }}
        />
      </div>

      {/* Per-file job list */}
      {jobList.length > 0 && (
        <ul className="space-y-2">
          {jobList.map((job) => (
            <li
              key={job.id}
              className="flex items-center gap-3 rounded-md border bg-card px-3 py-2"
            >
              {/* Status icon */}
              <div className="shrink-0">
                {job.status === "done" ? (
                  <CheckCircle className="size-4 text-green-500" aria-hidden />
                ) : job.status === "failed" ? (
                  <AlertCircle className="size-4 text-destructive" aria-hidden />
                ) : (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
                )}
              </div>

              {/* File info + progress */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{job.file.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatBytes(job.file.size)}
                  </span>
                </div>

                {/* Status text */}
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {job.status === "queued" && t("queued")}
                  {job.status === "uploading" &&
                    `${t("uploading")} ${Math.round(job.progress * 100)}%`}
                  {job.status === "done" && t("done")}
                  {job.status === "failed" &&
                    job.error &&
                    getErrorText(job.error.kind)}
                </p>

                {/* Progress bar — shown while uploading */}
                {(job.status === "uploading" || job.status === "queued") && (
                  <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-150"
                      style={{ width: `${job.progress * 100}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Dismiss button for failed jobs only */}
              {job.status === "failed" && (
                <button
                  type="button"
                  aria-label={t("failed")}
                  onClick={() => dismissJob(job.id)}
                  className="shrink-0 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
