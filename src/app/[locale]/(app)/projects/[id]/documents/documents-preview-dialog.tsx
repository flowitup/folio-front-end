"use client";

import { useEffect, useRef, useState } from "react";
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
import type { ProjectDocument } from "@/lib/api/project-documents";
import {
  fetchProjectDocumentBlob,
  downloadProjectDocument,
} from "@/lib/api/project-document-blob";

// ---- Props ----

type Props = {
  doc: ProjectDocument | null;
  projectId: string;
  onClose: () => void;
};

// ---- Component ----

export function DocumentsPreviewDialog({ doc, projectId, onClose }: Props) {
  const t = useTranslations("documents.preview");

  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [contentType, setContentType] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  // Keep a ref to the revoke function so we can call it on cleanup
  const revokeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Revoke previous blob URL and reset state when doc changes
    if (revokeRef.current) {
      revokeRef.current();
      revokeRef.current = null;
    }
    setBlobUrl(null);
    setContentType(null);
    setError(null);

    if (!doc) return;

    const controller = new AbortController();
    setLoading(true);

    fetchProjectDocumentBlob(projectId, doc.id, controller.signal)
      .then((b) => {
        if (controller.signal.aborted) {
          b.revoke();
          return;
        }
        revokeRef.current = b.revoke;
        setBlobUrl(b.objectUrl);
        setContentType(b.contentType);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [doc, projectId]);

  // Revoke on unmount
  useEffect(() => {
    return () => {
      if (revokeRef.current) {
        revokeRef.current();
        revokeRef.current = null;
      }
    };
  }, []);

  async function handleDownload() {
    if (!doc) return;
    setDownloading(true);
    try {
      await downloadProjectDocument(projectId, doc.id, doc.filename);
    } catch {
      // Download errors are silent — the file dialog simply won't appear
    } finally {
      setDownloading(false);
    }
  }

  const showPdf = blobUrl && doc?.kind === "pdf";
  const showImage = blobUrl && doc?.kind === "image";

  return (
    <Dialog open={doc !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-full" showCloseButton>
        <DialogHeader>
          <DialogTitle className="truncate pr-8">
            {doc?.filename ?? ""}
          </DialogTitle>
        </DialogHeader>

        {/* Body */}
        <div className="min-h-[200px]">
          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground">{doc?.filename ?? ""}</p>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
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
            <embed
              src={`${blobUrl}#toolbar=0`}
              type="application/pdf"
              className="h-[80vh] w-full rounded"
            />
          )}

          {!loading && !error && showImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={blobUrl}
              alt={doc?.filename ?? ""}
              className="max-h-[80vh] mx-auto rounded object-contain"
            />
          )}

          {!loading && !error && !showPdf && !showImage && doc !== null && (
            <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
              <p className="text-sm text-muted-foreground">
                {t("fallback")}
              </p>
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

        {/* Footer */}
        <DialogFooter>
          {doc !== null && (
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
