"use client";

/**
 * BillingPdfPreviewDialog — opens a devis / facture PDF in the page.
 *
 * The API renders the PDF on demand; the bytes are drawn with PDF.js (the
 * same viewer as project documents) so the document opens on phones and in
 * browsers without a PDF plugin, and the Download button saves those same
 * bytes without asking the server to render it twice.
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Download, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PdfCanvasViewer } from "@/app/[locale]/(app)/projects/[id]/documents/pdf-canvas-viewer";
import { env } from "@/lib/config/env";
import { parseFilenameFromContentDisposition } from "@/lib/api/_helpers/content-disposition";
import { triggerBrowserDownload } from "@/lib/util/trigger-browser-download";

type PreviewTarget = { id: string; document_number: string };

interface BillingPdfPreviewDialogProps {
  /** Document to preview; null keeps the dialog closed. */
  document: PreviewTarget | null;
  onClose: () => void;
}

type Loaded = { bytes: ArrayBuffer; filename: string };

export function BillingPdfPreviewDialog({ document, onClose }: BillingPdfPreviewDialogProps) {
  const t = useTranslations("documents.preview");
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLoaded(null);
    setFailed(false);
    if (!document) return;

    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch(
          `${env.apiBaseUrl}/billing-documents/${encodeURIComponent(document.id)}/pdf`,
          { method: "GET", credentials: "include", signal: controller.signal },
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const filename = parseFilenameFromContentDisposition(
          response.headers.get("Content-Disposition"),
          `${document.document_number}.pdf`,
        );
        const bytes = await response.arrayBuffer();
        if (!controller.signal.aborted) setLoaded({ bytes, filename });
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    })();

    return () => controller.abort();
  }, [document]);

  function handleDownload() {
    if (!loaded) return;
    triggerBrowserDownload(
      new Blob([loaded.bytes], { type: "application/pdf" }),
      loaded.filename,
    );
  }

  return (
    <Dialog open={document !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="sm:max-w-4xl w-full h-[85vh] max-h-[95vh] grid-rows-[auto_1fr_auto] overflow-hidden"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle className="truncate pr-8">
            {document?.document_number ?? ""}
          </DialogTitle>
          <DialogDescription className="sr-only">{t("loading")}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-auto">
          {failed ? (
            <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
              {t("error")}
            </div>
          ) : loaded ? (
            <PdfCanvasViewer
              src=""
              data={loaded.bytes}
              label={document?.document_number}
              onLoadError={() => setFailed(true)}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
              <span className="sr-only">{t("loading")}</span>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button variant="outline" onClick={onClose}>
            {t("close")}
          </Button>
          <Button variant="outline" onClick={handleDownload} disabled={!loaded} className="gap-2">
            <Download className="size-4" aria-hidden />
            {t("download")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
