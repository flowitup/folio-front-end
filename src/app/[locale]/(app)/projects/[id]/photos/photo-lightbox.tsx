"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { fetchProjectPhotoBlob } from "@/lib/api/project-photo-blob";
import { updatePhotoAction, deletePhotoAction } from "./actions";
import type { ProjectPhoto } from "@/lib/api/project-photos";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  projectId: string;
  photo: ProjectPhoto | null;
  /** True when the viewer is an admin or project owner (all-photo edit rights). */
  canEdit: boolean;
  /** Server-resolved id of the authenticated user; grants edit rights on own photos. */
  currentUserId: string;
  onClose: () => void;
  onDeleted: (photoId: string) => void;
  onUpdated: (photo: ProjectPhoto) => void;
}

/**
 * Full-resolution photo lightbox with inline caption/date editing and delete.
 * Loads the original via authenticated blob fetch; revokes object URL on close.
 */
export function PhotoLightbox({
  projectId,
  photo,
  canEdit,
  currentUserId,
  onClose,
  onDeleted,
  onUpdated,
}: Props) {
  const t = useTranslations("photos");
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const revokeRef = useRef<(() => void) | null>(null);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [captionDraft, setCaptionDraft] = useState("");
  const [capturedAtDraft, setCapturedAtDraft] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete confirm dialog state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Track the last photo id whose blob was loaded so we can reset state when
  // the selection changes without calling setState synchronously in an effect.
  const [loadedPhotoId, setLoadedPhotoId] = useState<string | null>(null);

  // When a different photo is selected, clear stale blob/edit state by
  // resetting loadedPhotoId — the render below derives isStale from this.
  useEffect(() => {
    if (!photo) return;
    if (photo.id === loadedPhotoId) return;

    const controller = new AbortController();
    let cancelled = false;

    fetchProjectPhotoBlob(projectId, photo.id, "original", controller.signal)
      .then((blob) => {
        if (cancelled) {
          blob.revoke();
          return;
        }
        // Revoke the previous blob before replacing it
        revokeRef.current?.();
        revokeRef.current = blob.revoke;
        setObjectUrl(blob.objectUrl);
        setLoadError(false);
        setEditing(false);
        setLoadedPhotoId(photo.id);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(true);
          setLoadedPhotoId(photo.id);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, photo?.id]);

  // When the dialog closes, revoke the object URL and clear state
  useEffect(() => {
    if (photo) return;
    revokeRef.current?.();
    revokeRef.current = null;
    setObjectUrl(null);
    setLoadError(false);
    setEditing(false);
    setLoadedPhotoId(null);
  }, [photo]);

  // Revoke any live object URL when the component unmounts while a photo is
  // still selected (prevents blob URL leak if the parent unmounts mid-session).
  useEffect(() => {
    return () => {
      revokeRef.current?.();
    };
  }, []);

  // Seed edit drafts from photo when starting an edit session
  function startEditing() {
    if (!photo) return;
    setCaptionDraft(photo.caption ?? "");
    // Convert ISO datetime to YYYY-MM-DD for the date input
    const dateOnly = photo.capturedAt ? photo.capturedAt.slice(0, 10) : "";
    setCapturedAtDraft(dateOnly);
    setEditing(true);
  }

  async function handleSave() {
    if (!photo) return;
    setSaving(true);
    const result = await updatePhotoAction(projectId, photo.id, {
      caption: captionDraft.trim() || null,
      capturedAt: capturedAtDraft || undefined,
    });
    setSaving(false);
    if (result.ok) {
      onUpdated(result.data);
      setEditing(false);
      toast.success(t("save"));
    } else {
      const key = result.error as keyof typeof errorKeys;
      toast.error(t(`errors.${errorKeys[key] ?? "server"}`));
    }
  }

  async function handleDelete() {
    if (!photo) return;
    setDeleting(true);
    const result = await deletePhotoAction(projectId, photo.id);
    setDeleting(false);
    if (result.ok) {
      setDeleteOpen(false);
      onDeleted(photo.id);
      onClose();
    } else {
      const key = result.error as keyof typeof errorKeys;
      toast.error(t(`errors.${errorKeys[key] ?? "server"}`));
    }
  }

  // Map action error codes to i18n keys
  const errorKeys: Record<string, string> = {
    forbidden: "forbidden",
    rateLimited: "rateLimited",
    network: "network",
    server: "server",
    oversize: "oversize",
    unsupported: "unsupported",
    invalidImage: "invalidImage",
  };

  const open = photo !== null;

  // Per-photo edit right: admin/owner (canEdit) OR the uploader of this photo.
  const canEditThisPhoto = canEdit || (photo !== null && photo.uploaderId === currentUserId);

  // Format date for display
  const displayDate = photo?.capturedAt
    ? new Date(photo.capturedAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-3xl w-full p-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>{photo?.caption ?? photo?.filename ?? t("title")}</DialogTitle>
          </DialogHeader>

          {/* Image area */}
          <div className="relative flex items-center justify-center bg-black min-h-[300px] max-h-[60vh]">
            {!objectUrl && !loadError && (
              <Loader2 className="size-8 animate-spin text-white/60" />
            )}
            {loadError && (
              <p className="text-sm text-white/60">{t("errors.network")}</p>
            )}
            {objectUrl && (
              <img
                src={objectUrl}
                alt={photo?.caption ?? photo?.filename ?? ""}
                className="max-h-[60vh] max-w-full object-contain"
              />
            )}
          </div>

          {/* Metadata + actions */}
          <div className="p-5 space-y-4">
            {!editing ? (
              <>
                {/* Display mode */}
                {photo?.caption && (
                  <p className="text-sm text-foreground">{photo.caption}</p>
                )}
                {displayDate && (
                  <p className="text-xs text-muted-foreground">{displayDate}</p>
                )}
                <div className="flex gap-2">
                  {canEditThisPhoto && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={startEditing}
                    >
                      {t("edit")}
                    </Button>
                  )}
                  {canEditThisPhoto && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteOpen(true)}
                    >
                      {t("delete")}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onClose}
                    className="ml-auto"
                  >
                    {t("cancel")}
                  </Button>
                </div>
              </>
            ) : (
              <>
                {/* Edit mode */}
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="photo-caption">{t("caption.label")}</Label>
                    <Input
                      id="photo-caption"
                      value={captionDraft}
                      onChange={(e) => setCaptionDraft(e.target.value)}
                      placeholder={t("caption.placeholder")}
                      maxLength={500}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="photo-captured-at">{t("capturedAt.label")}</Label>
                    <Input
                      id="photo-captured-at"
                      type="date"
                      value={capturedAtDraft}
                      onChange={(e) => setCapturedAtDraft(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? <Loader2 className="size-3.5 animate-spin mr-1" /> : null}
                    {t("save")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditing(false)}
                    disabled={saving}
                  >
                    {t("cancel")}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteConfirm.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteConfirm.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="size-3.5 animate-spin mr-1" /> : null}
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
