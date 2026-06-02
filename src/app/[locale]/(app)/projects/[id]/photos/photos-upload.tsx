"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { uploadProjectPhoto } from "@/lib/api/project-photo-blob";
import type { ProjectPhoto } from "@/lib/api/project-photo-blob";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ---- Constants ----

const MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25 MiB

// Accepted MIME types for client-side validation
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

// ---- Types ----

interface Props {
  projectId: string;
  onUploaded: (photo: ProjectPhoto) => void;
}

// ---- Error classification ----

/**
 * Maps HTTP status and BE error codes from uploadProjectPhoto into i18n keys.
 * err.body.error takes priority over err.status for the most specific match.
 */
function classifyError(err: unknown): string {
  const e = err as {
    status?: number;
    body?: { error?: string; message?: string } | null;
  };
  const code = e.body?.error;
  const status = e.status;

  // Photo-specific BE error codes (most specific — checked first)
  if (code === "FILE_TOO_LARGE") return "oversize";
  if (code === "UNSUPPORTED_TYPE") return "unsupported";
  if (code === "INVALID_IMAGE") return "invalidImage";

  // HTTP status fallbacks
  if (status === 413) return "oversize";
  if (status === 415) return "unsupported";
  if (status === 403) return "forbidden";
  if (status === 429) return "rateLimited";
  if (status === 0 || !status) return "network";

  return "server";
}

// ---- Component ----

/**
 * Photo batch upload control.
 * Validates files client-side (size + MIME), then POSTs each directly to the
 * BE API from the browser — no bytes pass through the Next server. A shared
 * caption and captured date are applied to the entire batch.
 */
export function PhotosUpload({ projectId, onUploaded }: Props) {
  const t = useTranslations("photos");
  const inputRef = useRef<HTMLInputElement>(null);

  const [caption, setCaption] = useState("");
  const [capturedAt, setCapturedAt] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  async function handleFiles(files: File[]) {
    if (files.length === 0) return;

    // Client-side validation
    for (const file of files) {
      if (file.size > MAX_SIZE_BYTES) {
        toast.error(t("errors.oversize"), { description: file.name });
        return;
      }
      if (!ALLOWED_MIME.has(file.type)) {
        toast.error(t("errors.unsupported"), { description: file.name });
        return;
      }
    }

    setUploading(true);
    setProgress({ done: 0, total: files.length });

    let successCount = 0;

    for (const file of files) {
      try {
        const photo = await uploadProjectPhoto(projectId, file, {
          caption: caption.trim() || undefined,
          capturedAt: capturedAt || undefined,
        });
        onUploaded(photo);
        successCount++;
      } catch (err: unknown) {
        const errorKey = classifyError(err);
        const msgKey = `errors.${errorKey}` as Parameters<typeof t>[0];
        toast.error(t(msgKey), { description: file.name });
      }

      setProgress((prev) => prev ? { ...prev, done: prev.done + 1 } : null);
    }

    setUploading(false);
    setProgress(null);

    if (successCount > 0) {
      toast.success(t("uploadSuccess", { count: successCount }));
      // Reset shared fields after a successful batch
      setCaption("");
      setCapturedAt("");
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-dashed p-4">
      {/* Shared caption + date for the batch */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="upload-caption">{t("caption.label")}</Label>
          <Input
            id="upload-caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder={t("caption.placeholder")}
            maxLength={500}
            disabled={uploading}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="upload-captured-at">{t("capturedAt.label")}</Label>
          <Input
            id="upload-captured-at"
            type="date"
            value={capturedAt}
            onChange={(e) => setCapturedAt(e.target.value)}
            disabled={uploading}
          />
        </div>
      </div>

      {/* File picker */}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="gap-2"
        >
          <Upload className="size-4" aria-hidden />
          {t("addPhotos")}
        </Button>

        {uploading && progress && (
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t("uploading")} {progress.done}/{progress.total}
          </span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = ""; // allow re-selecting the same files
          void handleFiles(files);
        }}
      />
    </div>
  );
}
