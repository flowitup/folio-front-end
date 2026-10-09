"use client";

import { useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { dayKeyToUtcNoon, parisDayKey } from "@/lib/utils/paris-day";
import { AlertCircle, Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhotoThumb } from "./photo-thumb";
import { PhotosUpload } from "./photos-upload";
import { PhotoLightbox } from "./photo-lightbox";
import { loadMorePhotosAction } from "./actions";
import type { ProjectPhoto } from "@/lib/api/project-photos";

/** Page size of the photo list; page.tsx and loadMorePhotosAction use the same. */
const PER_PAGE = 50;

interface Props {
  projectId: string;
  initialPhotos: ProjectPhoto[];
  initialTotal: number;
  /** The server could not read the photo list: show an error with a retry, not "No media yet". */
  initialLoadFailed?: boolean;
  /** Write rights on the project's photos (effective `project:update`). */
  canEdit: boolean;
}

/**
 * Client gallery: date-grouped responsive grid, upload panel, lightbox, and
 * paginated "Load more" button.
 * Photos are grouped by capturedAt date (YYYY-MM-DD), newest group first.
 */
export function PhotosGallery({
  projectId,
  initialPhotos,
  initialTotal,
  initialLoadFailed = false,
  canEdit,
}: Props) {
  const t = useTranslations("photos");
  const format = useFormatter();

  const [photos, setPhotos] = useState<ProjectPhoto[]>(initialPhotos);
  const [total, setTotal] = useState(initialTotal);
  // Rows of the server's order (newest capture first) loaded so far, counted
  // from the top. "Load more" asks for the page holding the next row instead
  // of a page counter, so a delete (which moves later rows up by one) never
  // makes it skip a photo.
  const [serverLoaded, setServerLoaded] = useState(initialPhotos.length);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadFailed, setLoadFailed] = useState(initialLoadFailed);
  const [retrying, setRetrying] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<ProjectPhoto | null>(null);

  // Prepend newly uploaded photo to the list
  function handleUploaded(photo: ProjectPhoto) {
    setPhotos((prev) => [photo, ...prev]);
    setTotal((prev) => prev + 1);
  }

  // Remove deleted photo from the list
  function handleDeleted(photoId: string) {
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    setTotal((prev) => Math.max(0, prev - 1));
    setServerLoaded((prev) => Math.max(0, prev - 1));
  }

  // Replace updated photo in place
  function handleUpdated(updated: ProjectPhoto) {
    // A new capture date moves the row in the server's order; if it moved out
    // of the loaded rows, the next row slid up into them, as after a delete.
    const before = photos.find((p) => p.id === updated.id);
    if (before && before.capturedAt !== updated.capturedAt) {
      setServerLoaded((prev) => Math.max(0, prev - 1));
    }
    setPhotos((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    // If lightbox is open on this photo, update it too
    if (selectedPhoto?.id === updated.id) {
      setSelectedPhoto(updated);
    }
  }

  async function handleLoadMore() {
    setLoadingMore(true);
    const nextPage = Math.floor(serverLoaded / PER_PAGE) + 1;
    const result = await loadMorePhotosAction(projectId, nextPage);
    setLoadingMore(false);
    if (!result.ok) return;

    setPhotos((prev) => {
      // Deduplicate by id in case of concurrent uploads
      const existingIds = new Set(prev.map((p) => p.id));
      const fresh = result.data.items.filter((p) => !existingIds.has(p.id));
      return [...prev, ...fresh];
    });
    setTotal(result.data.total);
    setServerLoaded((nextPage - 1) * PER_PAGE + result.data.items.length);
  }

  async function handleRetry() {
    setRetrying(true);
    const result = await loadMorePhotosAction(projectId, 1);
    setRetrying(false);
    if (!result.ok) return;

    setPhotos((prev) => {
      // Keep anything uploaded meanwhile that the fresh page does not hold
      const freshIds = new Set(result.data.items.map((p) => p.id));
      return [...prev.filter((p) => !freshIds.has(p.id)), ...result.data.items];
    });
    setTotal(result.data.total);
    setServerLoaded(result.data.items.length);
    setLoadFailed(false);
  }

  // Group photos by YYYY-MM-DD of capturedAt, newest date first
  type DateGroup = { dateKey: string; label: string; photos: ProjectPhoto[] };

  const groups: DateGroup[] = [];
  const seen = new Map<string, DateGroup>();

  for (const photo of photos) {
    // The Paris day, as the lightbox shows it (not the UTC day of the timestamp).
    const dateKey = photo.capturedAt ? parisDayKey(photo.capturedAt) : "unknown";
    let group = seen.get(dateKey);
    if (!group) {
      let label: string;
      if (dateKey === "unknown") {
        label = "—";
      } else {
        try {
          label = format.dateTime(dayKeyToUtcNoon(dateKey), {
            year: "numeric",
            month: "long",
            day: "numeric",
            timeZone: "UTC",
          });
        } catch {
          label = dateKey;
        }
      }
      group = { dateKey, label, photos: [] };
      seen.set(dateKey, group);
      groups.push(group);
    }
    group.photos.push(photo);
  }

  // Sort groups newest-first (lexicographic on YYYY-MM-DD is correct for dates)
  groups.sort((a, b) => {
    if (a.dateKey === "unknown") return 1;
    if (b.dateKey === "unknown") return -1;
    return b.dateKey.localeCompare(a.dateKey);
  });

  const isEmpty = photos.length === 0 && !loadFailed;
  const hasMore = photos.length < total;

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{t("title")}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        {canEdit && (
          <Button
            type="button"
            size="sm"
            variant={showUpload ? "secondary" : "default"}
            onClick={() => setShowUpload((v) => !v)}
            className="gap-2"
          >
            <Camera className="size-4" aria-hidden />
            {t("addPhotos")}
          </Button>
        )}
      </div>

      {/* Upload panel — toggled */}
      {showUpload && canEdit && (
        <PhotosUpload
          projectId={projectId}
          onUploaded={(photo) => {
            handleUploaded(photo);
          }}
        />
      )}

      {/* Load error — the list could not be read, which is not "no media" */}
      {loadFailed && (
        <div
          role="alert"
          className="flex flex-col items-center justify-center gap-4 py-20 text-center"
        >
          <AlertCircle className="size-12 text-muted-foreground/40" aria-hidden />
          <div>
            <p className="font-medium">{t("loadError.title")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("loadError.description")}</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleRetry}
            disabled={retrying}
            className="gap-2"
          >
            {retrying ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {t("loadError.retry")}
          </Button>
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <Camera className="size-12 text-muted-foreground/40" aria-hidden />
          <div>
            <p className="font-medium">{t("empty.title")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("empty.description")}</p>
          </div>
          {canEdit && (
            <Button
              type="button"
              size="sm"
              onClick={() => setShowUpload(true)}
              className="gap-2"
            >
              <Camera className="size-4" aria-hidden />
              {t("addPhotos")}
            </Button>
          )}
        </div>
      )}

      {/* Date-grouped grids */}
      {groups.map((group) => (
        <section key={group.dateKey} aria-label={group.label}>
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
            {group.label}
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {group.photos.map((photo) => (
              <PhotoThumb
                key={photo.id}
                projectId={projectId}
                photo={photo}
                onClick={() => setSelectedPhoto(photo)}
              />
            ))}
          </div>
        </section>
      ))}

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="gap-2"
          >
            {loadingMore ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {t("loadMore")}
          </Button>
        </div>
      )}

      {/* Lightbox */}
      <PhotoLightbox
        projectId={projectId}
        photo={selectedPhoto}
        canEdit={canEdit}
        onClose={() => setSelectedPhoto(null)}
        onDeleted={handleDeleted}
        onUpdated={handleUpdated}
      />
    </div>
  );
}
