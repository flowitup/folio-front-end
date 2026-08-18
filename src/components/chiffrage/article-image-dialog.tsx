"use client";

/**
 * Attach a photo to an article: upload a file, or paste a supplier URL the
 * server fetches.
 *
 * The upload goes through a server action rather than straight from the
 * browser: cookie-authenticated mutations need an X-CSRF-TOKEN header
 * (JWT_COOKIE_CSRF_PROTECT), while the server-side call carries a Bearer token,
 * which Flask-JWT-Extended accepts without the CSRF dance. A direct client POST
 * returns 401 — found by running it, not by any test.
 */

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ChiffrageArticle } from "@/lib/api/chiffrage";

/** Mirrors the backend cap so an oversized file fails before the round-trip. */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ACCEPTED = "image/jpeg,image/png,image/webp";

interface Props {
  open: boolean;
  article: ChiffrageArticle;
  onOpenChange: (open: boolean) => void;
  onUpload: (formData: FormData) => Promise<boolean>;
  onFromUrl: (url: string) => Promise<boolean>;
  onRemove: () => Promise<boolean>;
}

export function ArticleImageDialog({
  open,
  article,
  onOpenChange,
  onUpload,
  onFromUrl,
  onRemove,
}: Props) {
  const t = useTranslations("chiffrage");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const hasOwnImage = article.image_ref?.kind === "article";

  const upload = async (file: File) => {
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error(t("imageTooLarge"));
      return;
    }
    setBusy(true);
    const form = new FormData();
    form.append("image", file);
    const ok = await onUpload(form);
    setBusy(false);
    if (ok) onOpenChange(false);
    else toast.error(t("imageUploadFailed"));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("articleImage")}</DialogTitle>
          <DialogDescription>{t("articleImageHint")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="article-image-file">{t("uploadImage")}</Label>
            <Input
              id="article-image-file"
              ref={fileRef}
              type="file"
              accept={ACCEPTED}
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file);
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="article-image-url">{t("imageFromUrl")}</Label>
            <div className="flex gap-2">
              <Input
                id="article-image-url"
                type="url"
                inputMode="url"
                value={url}
                placeholder={t("imageFromUrlPlaceholder")}
                onChange={(e) => setUrl(e.target.value)}
              />
              <Button
                type="button"
                disabled={busy || !url.trim()}
                onClick={async () => {
                  setBusy(true);
                  const ok = await onFromUrl(url.trim());
                  setBusy(false);
                  if (ok) {
                    setUrl("");
                    onOpenChange(false);
                  }
                }}
              >
                {t("fetch")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("imageFromUrlNote")}
            </p>
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          {hasOwnImage ? (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const ok = await onRemove();
                setBusy(false);
                if (ok) onOpenChange(false);
              }}
            >
              {t("removeImage")}
            </Button>
          ) : (
            <span />
          )}
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            {t("close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
