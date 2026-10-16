"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Play, RefreshCw } from "lucide-react";
import { fetchProjectPhotoBlob } from "@/lib/api/project-photo-blob";
import type { ProjectPhoto } from "@/lib/api/project-photos";
import { isVideo } from "@/lib/media/is-video";

interface Props {
  projectId: string;
  photo: ProjectPhoto;
  onClick: () => void;
}

/**
 * Lazy-loading thumbnail cell.
 * Fetches the thumbnail blob on mount via authenticated fetch, shows a
 * skeleton while loading, and revokes the object URL on unmount to prevent
 * memory leaks.
 */
export function PhotoThumb({ projectId, photo, onClick }: Props) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const t = useTranslations("photos");
  const [error, setError] = useState(false);
  // Bumped by the retry button to load the thumbnail again
  const [attempt, setAttempt] = useState(0);
  const revokeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setError(false);

    fetchProjectPhotoBlob(projectId, photo.id, "thumbnail", controller.signal)
      .then((blob) => {
        if (cancelled) {
          blob.revoke();
          return;
        }
        revokeRef.current = blob.revoke;
        setObjectUrl(blob.objectUrl);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
      controller.abort();
      // Revoke object URL when component unmounts to free memory
      revokeRef.current?.();
      revokeRef.current = null;
    };
  }, [projectId, photo.id, attempt]);

  const label = photo.caption ?? photo.filename;

  if (error) {
    // A thumbnail that failed (network, rate limit) can be loaded again in place;
    // the photo itself still opens from the tile.
    return (
      <div className="relative aspect-square w-full overflow-hidden rounded-md bg-muted">
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground"
        >
          <span className="sr-only">{label}</span>
        </button>
        <button
          type="button"
          onClick={() => setAttempt((n) => n + 1)}
          aria-label={t("retryThumbnail")}
          title={t("retryThumbnail")}
          className="absolute left-1/2 top-1/2 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 text-muted-foreground shadow-sm hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RefreshCw className="size-4" aria-hidden />
        </button>
      </div>
    );
  }

  if (!objectUrl) {
    // Skeleton while blob is loading
    return (
      <div
        className="aspect-square w-full animate-pulse rounded-md bg-muted"
        aria-busy="true"
        aria-label={label}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="relative aspect-square w-full overflow-hidden rounded-md bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <img
        src={objectUrl}
        alt={label}
        loading="lazy"
        className="h-full w-full object-cover transition-opacity duration-200"
      />
      {isVideo(photo.contentType) && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex size-9 items-center justify-center rounded-full bg-black/55 text-white">
            <Play className="size-4 translate-x-px fill-current" aria-hidden />
          </span>
        </span>
      )}
    </button>
  );
}
