"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
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
import { Button } from "@/components/ui/button";
import type { InvoiceAttachment } from "@/types/invoice";

type Props = {
  attachment: InvoiceAttachment | null;
  onCancel: () => void;
  onConfirm: (newFilename: string) => Promise<void> | void;
};

/** The stored name's column length; the backend refuses a longer name. */
const MAX_FILENAME_LENGTH = 255;

/** The extension the backend compares, like Python's os.path.splitext. */
function fileExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i).toLowerCase() : "";
}

export function InvoiceAttachmentRenameDialog({ attachment, onCancel, onConfirm }: Props) {
  const t = useTranslations("invoices.attachmentRename");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (attachment) {
      setValue(attachment.filename);
      setError(null);
    }
  }, [attachment]);

  const extension = attachment ? fileExtension(attachment.filename) : "";
  const unchanged = value.trim() === attachment?.filename;
  const empty = !value.trim();
  // The backend refuses a changed extension; say so before saving.
  const extensionChanged = !empty && fileExtension(value.trim()) !== extension;
  // Said before saving rather than as the generic failure the API's 400 gives.
  const tooLong = value.trim().length > MAX_FILENAME_LENGTH;
  const invalid = empty || unchanged || extensionChanged || tooLong;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (invalid || loading) return;
    setLoading(true);
    setError(null);
    try {
      await onConfirm(value.trim());
    } catch {
      setError(t("error"));
    } finally {
      setLoading(false);
    }
  }

  const message = tooLong
    ? t("errorTooLong", { max: MAX_FILENAME_LENGTH })
    : extensionChanged
      ? t("errorExtension", { extension })
      : error;

  return (
    <Dialog open={attachment !== null} onOpenChange={(open) => !open && !loading && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description", { extension })}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="attachment-rename-input" className="sr-only">
              {t("label")}
            </Label>
            <Input
              id="attachment-rename-input"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
              disabled={loading}
              autoFocus
              aria-invalid={message ? true : undefined}
              aria-describedby={message ? "attachment-rename-error" : undefined}
            />
            {message && (
              <p id="attachment-rename-error" role="alert" className="mt-2 text-sm text-destructive">
                {message}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={loading || invalid}>
              {loading ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
