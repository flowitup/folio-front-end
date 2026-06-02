"use client";

import { useEffect, useState } from "react";
import { Play } from "lucide-react";
import { loadLatestProjectPhotosAction } from "@/app/[locale]/(app)/projects/cover-photos-actions";
import { fetchProjectPhotoBlob } from "@/lib/api/project-photo-blob";
import { isVideo } from "@/lib/media/is-video";

interface CoverTile {
  url: string;
  video: boolean;
}

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
  const [tiles, setTiles] = useState<CoverTile[]>([]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const revokers: Array<() => void> = [];

    (async () => {
      const result = await loadLatestProjectPhotosAction(projectId, max);
      if (cancelled || !result.ok || result.photos.length === 0) return;

      const loaded: CoverTile[] = [];
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
          loaded.push({ url: blob.objectUrl, video: isVideo(photo.contentType) });
        } catch {
          // Skip a thumbnail that fails to load; others still render.
        }
      }
      if (!cancelled) setTiles(loaded);
    })();

    return () => {
      cancelled = true;
      controller.abort();
      revokers.forEach((r) => r());
    };
  }, [projectId, max]);

  if (tiles.length === 0) return null;

  // Tile spans: a single photo fills the cover; three photos give the first a
  // tall left column; otherwise an even grid.
  const cols = tiles.length === 1 ? 1 : 2;
  const spanFirst = tiles.length === 3;

  return (
    <div
      className="absolute inset-0 grid gap-px pointer-events-none"
      style={{
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridAutoRows: "1fr",
      }}
      aria-hidden
    >
      {tiles.map((tile, i) => (
        <div
          key={i}
          className="relative overflow-hidden"
          style={spanFirst && i === 0 ? { gridRow: "span 2" } : undefined}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={tile.url} alt="" className="h-full w-full object-cover" />
          {tile.video && (
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex size-7 items-center justify-center rounded-full bg-black/55 text-white">
                <Play className="size-3.5 translate-x-px fill-current" aria-hidden />
              </span>
            </span>
          )}
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
