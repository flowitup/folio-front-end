"use client";

import { type CSSProperties, useEffect, useEffectEvent, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { fetchAttachmentBlob } from "@/lib/api/invoice-api";
import { triggerBrowserDownload } from "@/lib/util/trigger-browser-download";
import type { InvoiceAttachment } from "@/types/invoice";
import { PdfCanvasViewer } from "@/app/[locale]/(app)/projects/[id]/documents/pdf-canvas-viewer";
import { ApiError } from "@/lib/api/http";
import {
  ResizableDialogHandles,
  type DialogBounds,
} from "@/app/[locale]/(app)/projects/[id]/documents/resizable-dialog-handles";

/**
 * Structural minimum the dialog needs — callers can pass any superset
 * (e.g. the full InvoiceAttachment) or a slimmer type like RefundableExpenseAttachment.
 */
export type PreviewableAttachment = Pick<InvoiceAttachment, "id" | "filename" | "mime_type">;

type Props = {
  attachment: PreviewableAttachment | null;
  onClose: () => void;
  /**
   * The file no longer exists (404, deleted elsewhere). The dialog closes
   * itself; the caller says so and refreshes its list. Without it, the dialog
   * still closes and shows a toast.
   */
  onGone?: (attachment: PreviewableAttachment) => void;
};

function isPdf(mime: string): boolean {
  return mime === "application/pdf";
}

function isImage(mime: string): boolean {
  return mime.startsWith("image/");
}

export function InvoiceAttachmentPreviewDialog({ attachment, onClose, onGone }: Props) {
  const t = useTranslations("invoices.attachmentPreview");
  // The image the browser could not decode (e.g. HEIC outside Safari): the
  // "no preview — download" panel is shown instead of an empty area.
  const [undecodableId, setUndecodableId] = useState<string | null>(null);
  // Reads the latest callbacks without making them load dependencies.
  const handleGone = useEffectEvent((gone: PreviewableAttachment) => {
    onGone?.(gone);
    onClose();
  });

  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  // The bytes the preview loaded: Download saves them instead of fetching again
  const [loadedBlob, setLoadedBlob] = useState<Blob | null>(null);
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [bounds, setBounds] = useState<DialogBounds | null>(null);
  const revokeRef = useRef<string | null>(null);

  useEffect(() => {
    if (revokeRef.current) {
      URL.revokeObjectURL(revokeRef.current);
      revokeRef.current = null;
    }
    setBlobUrl(null);
    setLoadedBlob(null);
    setPdfData(null);
    setError(null);
    setBounds(null);

    if (!attachment) return;

    const controller = new AbortController();
    setLoading(true);

    async function loadAttachment() {
      try {
        const blob = await fetchAttachmentBlob(attachment!.id);
        if (controller.signal.aborted) return;

        const url = URL.createObjectURL(blob);
        revokeRef.current = url;
        setBlobUrl(url);
        setLoadedBlob(blob);

        if (isPdf(attachment!.mime_type)) {
          setPdfData(await blob.arrayBuffer());
        }
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        // Gone (deleted elsewhere): nothing left to show or download.
        if (err instanceof ApiError && err.status === 404) {
          handleGone(attachment!);
          return;
        }
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadAttachment();

    return () => {
      controller.abort();
    };
  }, [attachment]);

  useEffect(() => {
    return () => {
      if (revokeRef.current) {
        URL.revokeObjectURL(revokeRef.current);
        revokeRef.current = null;
      }
    };
  }, []);

  async function handleDownload() {
    if (!attachment) return;
    if (loadedBlob) {
      triggerBrowserDownload(loadedBlob, attachment.filename);
      return;
    }
    setDownloading(true);
    try {
      const blob = await fetchAttachmentBlob(attachment.id);
      triggerBrowserDownload(blob, attachment.filename);
    } catch {
      toast.error(t("downloadError"));
    } finally {
      setDownloading(false);
    }
  }

  const mime = attachment?.mime_type ?? "";
  const showPdf = pdfData && isPdf(mime);
  const showImage = blobUrl && isImage(mime) && undecodableId !== attachment?.id;

  const resizeStyle: CSSProperties | undefined = bounds
    ? { top: bounds.y, left: bounds.x, width: bounds.w, height: bounds.h, transform: "none", translate: "none", maxWidth: "none" }
    : undefined;

  return (
    <Dialog open={attachment !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="sm:max-w-4xl w-full h-[85vh] max-h-[95vh] grid-cols-[minmax(0,1fr)] grid-rows-[auto_1fr_auto] overflow-hidden"
        style={resizeStyle}
        showCloseButton
        // The file itself is the content; there is no description to point at.
        aria-describedby={undefined}
      >
        <ResizableDialogHandles onResize={setBounds} />
        <DialogHeader className="min-w-0">
          <DialogTitle className="truncate pr-8" title={attachment?.filename}>
            {attachment?.filename ?? ""}
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 min-w-0 overflow-auto">
          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 h-full text-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground">{attachment?.filename ?? ""}</p>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center justify-center gap-4 h-full text-center">
              <p className="text-sm text-muted-foreground">{t("error")}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                disabled={downloading}
                className="gap-2"
              >
                <Download className="size-4" aria-hidden />
                {t("download")}
              </Button>
            </div>
          )}

          {!loading && !error && showPdf && (
            <PdfCanvasViewer
              src=""
              data={pdfData}
              label={attachment?.filename}
            />
          )}

          {!loading && !error && showImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={blobUrl}
              alt={attachment?.filename ?? ""}
              className="max-h-full max-w-full mx-auto rounded object-contain"
              onError={() => setUndecodableId(attachment?.id ?? null)}
            />
          )}

          {!loading && !error && !showPdf && !showImage && attachment !== null && (
            <div className="flex flex-col items-center justify-center gap-4 h-full text-center">
              <p className="text-sm text-muted-foreground">{t("fallback")}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                disabled={downloading}
                className="gap-2"
              >
                <Download className="size-4" aria-hidden />
                {t("download")}
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          {attachment !== null && (
            <Button
              variant="outline"
              onClick={handleDownload}
              disabled={downloading || loading}
              className="gap-2"
            >
              <Download className="size-4" aria-hidden />
              {t("download")}
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            {t("close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
