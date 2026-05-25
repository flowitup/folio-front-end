"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Download, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { fetchAttachmentBlob, fetchAttachmentBlobUrl } from "@/lib/api/invoice-api";
import type { InvoiceAttachment } from "@/types/invoice";
import { PdfCanvasViewer } from "@/app/[locale]/(app)/projects/[id]/documents/pdf-canvas-viewer";
import {
  ResizableDialogHandles,
  type DialogBounds,
} from "@/app/[locale]/(app)/projects/[id]/documents/resizable-dialog-handles";

type Props = {
  attachment: InvoiceAttachment | null;
  onClose: () => void;
};

function isPdf(mime: string): boolean {
  return mime === "application/pdf";
}

function isImage(mime: string): boolean {
  return mime.startsWith("image/");
}

export function InvoiceAttachmentPreviewDialog({ attachment, onClose }: Props) {
  const t = useTranslations("invoices.attachmentPreview");

  const [blobUrl, setBlobUrl] = useState<string | null>(null);
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

        if (isPdf(attachment!.mime_type)) {
          setPdfData(await blob.arrayBuffer());
        }
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
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
    setDownloading(true);
    try {
      const url = await fetchAttachmentBlobUrl(attachment.id);
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      // Download errors are silent — the save dialog simply won't appear
    } finally {
      setDownloading(false);
    }
  }

  const mime = attachment?.mime_type ?? "";
  const showPdf = pdfData && isPdf(mime);
  const showImage = blobUrl && isImage(mime);

  const resizeStyle: CSSProperties | undefined = bounds
    ? { top: bounds.y, left: bounds.x, width: bounds.w, height: bounds.h, transform: "none", translate: "none", maxWidth: "none" }
    : undefined;

  return (
    <Dialog open={attachment !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="sm:max-w-4xl w-full h-[85vh] max-h-[95vh] grid-rows-[auto_1fr_auto] overflow-hidden"
        style={resizeStyle}
        showCloseButton
      >
        <ResizableDialogHandles onResize={setBounds} />
        <DialogHeader>
          <DialogTitle className="truncate pr-8">
            {attachment?.filename ?? ""}
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 overflow-auto">
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
