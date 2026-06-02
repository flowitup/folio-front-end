"use client";

import { useEffect, useState } from "react";
import { loadLatestProjectPhotosAction } from "@/app/[locale]/(app)/projects/cover-photos-actions";
import { fetchProjectPhotoBlob } from "@/lib/api/project-photo-blob";

interface Props {
  projectId: string;
  /** Max number of latest photos to montage (capped at 4). */
  max?: number;
}

/**
 * Montage of a project's latest photos, used as the card cover. Fetches the
 * latest photo metadata (server action), then loads each thumbnail blob via
 * authenticated fetch and lays them out as a 1–4 tile grid. Renders nothing
 * when the project has no photos / no access, so the card's gradient cover
 * shows through. Decorative only — pointer-events are disabled so the
 * underlying cover button stays clickable.
 */
export function ProjectCoverPhotos({ projectId, max = 4 }: Props) {
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const revokers: Array<() => void> = [];

    (async () => {
      const result = await loadLatestProjectPhotosAction(projectId, max);
      if (cancelled || !result.ok || result.photos.length === 0) return;

      const loaded: string[] = [];
      for (const photo of result.photos) {
        try {
          const blob = await fetchProjectPhotoBlob(
            projectId,
            photo.id,
            "thumbnail",
            controller.signal,
          );
          if (cancelled) {
            blob.revoke();
            return;
          }
          revokers.push(blob.revoke);
          loaded.push(blob.objectUrl);
        } catch {
          // Skip a thumbnail that fails to load; others still render.
        }
      }
      if (!cancelled) setUrls(loaded);
    })();

    return () => {
      cancelled = true;
      controller.abort();
      revokers.forEach((r) => r());
    };
  }, [projectId, max]);

  if (urls.length === 0) return null;

  // Tile spans: a single photo fills the cover; three photos give the first a
  // tall left column; otherwise an even grid.
  const cols = urls.length === 1 ? 1 : 2;
  const spanFirst = urls.length === 3;

  return (
    <div
      className="absolute inset-0 grid gap-px pointer-events-none"
      style={{
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridAutoRows: "1fr",
      }}
      aria-hidden
    >
      {urls.map((url, i) => (
        <div
          key={i}
          className="overflow-hidden"
          style={spanFirst && i === 0 ? { gridRow: "span 2" } : undefined}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="h-full w-full object-cover" />
        </div>
      ))}
      {/* Scrim so the project stamp + phase label stay legible over photos. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.1) 35%, rgba(0,0,0,0.15) 70%, rgba(0,0,0,0.35) 100%)",
        }}
      />
    </div>
  );
}
