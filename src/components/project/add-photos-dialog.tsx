"use client";

import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
// Reuse the self-contained upload control from the photos route — it handles
// client-side validation, direct-to-BE upload, and its own success/error toasts.
import { PhotosUpload } from "@/app/[locale]/(app)/projects/[id]/photos/photos-upload";

interface AddPhotosDialogProps {
  projectId: string;
  projectName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Inline "Add photos" dialog launched from a project card. Lets the user upload
 * progress photos without navigating away to the photos page. Uploaded photos
 * persist on the project and surface on the photos gallery; nothing to track
 * locally here, so onUploaded is a no-op.
 */
export function AddPhotosDialog({
  projectId,
  projectName,
  open,
  onOpenChange,
}: AddPhotosDialogProps) {
  const t = useTranslations("photos");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("addPhotos")}</DialogTitle>
          <DialogDescription>
            {projectName} — {t("subtitle")}
          </DialogDescription>
        </DialogHeader>
        <PhotosUpload projectId={projectId} onUploaded={() => {}} />
      </DialogContent>
    </Dialog>
  );
}
