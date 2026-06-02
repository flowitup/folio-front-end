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

const MAX_IMAGE_BYTES = 25 * 1024 * 1024; // 25 MiB
const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MiB

// Accepted MIME types for client-side validation
const ALLOWED_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_VIDEO_MIME = new Set(["video/mp4", "video/webm", "video/quicktime"]);

// Accepted extensions — the primary signal. Browsers/OSes sometimes report an
// empty or "application/octet-stream" MIME for valid files (e.g. videos saved
// from messaging apps), so we validate by extension and treat a missing/generic
// MIME as a pass. This mirrors the backend's validate_media_type.
const ALLOWED_IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const ALLOWED_VIDEO_EXT = new Set([".mp4", ".webm", ".mov"]);

function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

/** Returns the media kind for an allowed file, or null if unsupported. */
export function mediaKind(file: File): "image" | "video" | null {
  const ext = fileExtension(file.name);
  const type = file.type;
  // Some sources report no/generic MIME; accept those by extension alone.
  const genericMime = type === "" || type === "application/octet-stream";
  if (ALLOWED_IMAGE_EXT.has(ext) && (ALLOWED_IMAGE_MIME.has(type) || genericMime)) return "image";
  if (ALLOWED_VIDEO_EXT.has(ext) && (ALLOWED_VIDEO_MIME.has(type) || genericMime)) return "video";
  return null;
}

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
      const kind = mediaKind(file);
      if (!kind) {
        toast.error(t("errors.unsupported"), { description: file.name });
        return;
      }
      // Per-kind size cap: videos get more headroom than images.
      const maxBytes = kind === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
      if (file.size > maxBytes) {
        toast.error(t("errors.oversize"), { description: file.name });
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
        accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,.jpg,.jpeg,.png,.webp,.mp4,.webm,.mov"
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
