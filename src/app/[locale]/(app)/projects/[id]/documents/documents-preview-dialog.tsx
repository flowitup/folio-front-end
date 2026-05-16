"use client";

import { useTranslations } from "next-intl";
import { Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ProjectDocument } from "@/lib/api/project-documents";

// ---- Props ----

type Props = {
  doc: ProjectDocument | null;
  onClose: () => void;
};

// ---- Component ----

export function DocumentsPreviewDialog({ doc, onClose }: Props) {
  const t = useTranslations("documents.preview");

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
          {doc?.kind === "pdf" && (
            <embed
              src={`${doc.download_url}#toolbar=0`}
              type="application/pdf"
              className="h-[80vh] w-full rounded"
            />
          )}

          {doc?.kind === "image" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={doc.download_url}
              alt={doc.filename}
              className="max-h-[80vh] mx-auto rounded object-contain"
            />
          )}

          {doc !== null && doc.kind !== "pdf" && doc.kind !== "image" && (
            <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
              <p className="text-sm text-muted-foreground">
                {t("fallback")}
              </p>
              <a
                href={doc.download_url}
                download={doc.filename}
                className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <Download className="size-4" />
                {t("download")}
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter>
          {doc !== null && (
            <a
              href={doc.download_url}
              download={doc.filename}
              className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <Download className="size-4" />
              {t("download")}
            </a>
          )}
          <Button variant="outline" onClick={onClose}>
            {t("close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
