"use client";

/**
 * BillingPdfPreviewDialog — opens a devis / facture PDF in the page.
 *
 * The API renders the PDF on demand; the bytes are drawn with PDF.js (the
 * same viewer as project documents) so the document opens on phones and in
 * browsers without a PDF plugin. The bytes come from the shared billing file
 * cache, so Download (here, in the list menu or in the form) reuses them
 * instead of asking the server to render the same version again.
 *
 * A failure is never a dead end: the dialog says why (with the wait for a
 * 429), offers Retry, and Download stays usable.
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Download, Loader2, RotateCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PdfCanvasViewer } from "@/app/[locale]/(app)/projects/[id]/documents/pdf-canvas-viewer";
import {
  BillingFileError,
  billingFileBlob,
  fetchBillingFile,
  type BillingFile,
  type BillingFileTarget,
} from "@/lib/api/billing/billing-file-client";
import { rateLimitMessage } from "@/lib/api/rate-limit";
import { triggerBrowserDownload } from "@/lib/util/trigger-browser-download";

interface BillingPdfPreviewDialogProps {
  /** Document to preview; null keeps the dialog closed. */
  document: BillingFileTarget | null;
  onClose: () => void;
}

type Failure = { status: number | null; retryAfter: number | null };

export function BillingPdfPreviewDialog({ document, onClose }: BillingPdfPreviewDialogProps) {
  const t = useTranslations("documents.preview");
  const tCommon = useTranslations("common");
  const [loaded, setLoaded] = useState<BillingFile | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [downloading, setDownloading] = useState(false);

  const docId = document?.id ?? null;
  const docVersion = document?.updated_at ?? null;
  const docNumber = document?.document_number ?? "";

  useEffect(() => {
    setLoaded(null);
    setFailure(null);
    if (!docId) return;

    let cancelled = false;
    fetchBillingFile({ id: docId, document_number: docNumber, updated_at: docVersion }, "pdf")
      .then((file) => {
        if (!cancelled) setLoaded(file);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setFailure(
          err instanceof BillingFileError
            ? { status: err.status, retryAfter: err.retryAfter }
            : { status: null, retryAfter: null },
        );
      });

    return () => {
      cancelled = true;
    };
  }, [docId, docVersion, docNumber, attempt]);

  async function handleDownload() {
    if (!document) return;
    if (loaded) {
      triggerBrowserDownload(billingFileBlob(loaded, "pdf"), loaded.filename);
      return;
    }
    setDownloading(true);
    try {
      const file = await fetchBillingFile(document, "pdf");
      triggerBrowserDownload(billingFileBlob(file, "pdf"), file.filename);
    } catch (err) {
      toast.error(
        err instanceof BillingFileError && err.status === 429
          ? rateLimitMessage(tCommon, err.retryAfter)
          : t("downloadError"),
      );
    } finally {
      setDownloading(false);
    }
  }

  const failureText =
    failure?.status === 429 ? rateLimitMessage(tCommon, failure.retryAfter) : t("error");

  return (
    <Dialog open={document !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="sm:max-w-4xl w-full h-[85vh] max-h-[95vh] grid-cols-[minmax(0,1fr)] grid-rows-[auto_1fr_auto] overflow-hidden"
        showCloseButton
        // The PDF is the content; status changes are announced in the body.
        aria-describedby={undefined}
      >
        <DialogHeader className="min-w-0">
          <DialogTitle className="truncate pr-8" title={docNumber}>
            {docNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 min-w-0 overflow-auto">
          {failure ? (
            <div
              className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground"
              role="alert"
            >
              <p>{failureText}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setAttempt((n) => n + 1)}
              >
                <RotateCw className="size-4" aria-hidden />
                {t("retry")}
              </Button>
            </div>
          ) : loaded ? (
            <PdfCanvasViewer
              src=""
              data={loaded.bytes}
              label={docNumber}
              onLoadError={() => setFailure({ status: null, retryAfter: null })}
            />
          ) : (
            <div className="flex h-full items-center justify-center" role="status">
              <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
              <span className="sr-only">{t("loading")}</span>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button variant="outline" onClick={onClose}>
            {t("close")}
          </Button>
          <Button
            variant="outline"
            onClick={handleDownload}
            disabled={downloading || (!loaded && !failure)}
            className="gap-2"
          >
            {downloading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Download className="size-4" aria-hidden />
            )}
            {t("download")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
