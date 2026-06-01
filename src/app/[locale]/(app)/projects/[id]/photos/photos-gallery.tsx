"use client";

import { useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhotoThumb } from "./photo-thumb";
import { PhotosUpload } from "./photos-upload";
import { PhotoLightbox } from "./photo-lightbox";
import type { ProjectPhoto } from "@/lib/api/project-photos";

interface Props {
  projectId: string;
  initialPhotos: ProjectPhoto[];
  initialTotal: number;
  canEdit: boolean;
}

/**
 * Client gallery: date-grouped responsive grid, upload panel, lightbox.
 * Photos are grouped by capturedAt date (YYYY-MM-DD), newest group first.
 */
export function PhotosGallery({
  projectId,
  initialPhotos,
  initialTotal,
  canEdit,
}: Props) {
  const t = useTranslations("photos");
  const format = useFormatter();

  const [photos, setPhotos] = useState<ProjectPhoto[]>(initialPhotos);
  const [_total, setTotal] = useState(initialTotal);
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
  }

  // Replace updated photo in place
  function handleUpdated(updated: ProjectPhoto) {
    setPhotos((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    // If lightbox is open on this photo, update it too
    if (selectedPhoto?.id === updated.id) {
      setSelectedPhoto(updated);
    }
  }

  // Group photos by YYYY-MM-DD of capturedAt, newest date first
  type DateGroup = { dateKey: string; label: string; photos: ProjectPhoto[] };

  const groups: DateGroup[] = [];
  const seen = new Map<string, DateGroup>();

  for (const photo of photos) {
    const dateKey = photo.capturedAt ? photo.capturedAt.slice(0, 10) : "unknown";
    let group = seen.get(dateKey);
    if (!group) {
      let label: string;
      if (dateKey === "unknown") {
        label = "—";
      } else {
        try {
          label = format.dateTime(new Date(dateKey), {
            year: "numeric",
            month: "long",
            day: "numeric",
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

  const isEmpty = photos.length === 0;

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
