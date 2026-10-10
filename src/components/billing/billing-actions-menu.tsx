"use client";

/**
 * BillingActionsMenu — `...` row action menu for billing documents.
 *
 * Items:
 *   - Edit → navigate to /billing/{segment}/{id} (segment = "devis" or "factures")
 *   - Preview PDF → open the rendered PDF in a dialog
 *   - Download PDF → fetch PDF blob then trigger browser download
 *   - Convert to Facture → only rendered for devis with status=accepted
 *   - Delete → confirm then call server action
 */

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  MoreHorizontal,
  Pencil,
  Download,
  Eye,
  FileSpreadsheet,
  ArrowRightLeft,
  Trash2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { triggerBrowserDownload } from "@/lib/util/trigger-browser-download";
import { deleteBillingDocumentAction, convertDevisToFactureAction } from "@/app/[locale]/(app)/billing/_actions/billing-actions";
import { env } from "@/lib/config/env";
import { parseFilenameFromContentDisposition } from "@/lib/api/_helpers/content-disposition";
import { fetchWithRefresh } from "@/lib/api/refresh";
import type { BillingDocument } from "@/types/billing";
import { kindToSegment } from "@/lib/billing/url-helpers";
import { BillingPdfPreviewDialog } from "@/components/billing/billing-pdf-preview-dialog";
import { BillingDeleteDialog } from "@/components/billing/billing-delete-dialog";
import { useBillingErrorMessage } from "@/components/billing/use-billing-error-message";

interface BillingActionsMenuProps {
  document: BillingDocument;
  onMutated: () => void;
}

export function BillingActionsMenu({ document, onMutated }: BillingActionsMenuProps) {
  const router = useRouter();
  const locale = useLocale();
  const tActions = useTranslations("billing.form.actions");
  const tErrors = useTranslations("billing.form.errors");
  const tToast = useTranslations("billing.form.toast");
  const errorMessage = useBillingErrorMessage();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [isXlsxLoading, setIsXlsxLoading] = useState(false);
  const [isConverting, setIsConverting] = useState(false);

  // Double-submit guards — synchronous check before React commit
  const pdfLoadingRef = useRef(false);
  const xlsxLoadingRef = useRef(false);
  const convertingRef = useRef(false);
  const deletingRef = useRef(false);

  const editPath = `/${locale}/billing/${kindToSegment(document.kind)}/${document.id}`;

  const convertedFactureId = document.converted_to_facture_id ?? null;
  const showConvertToFacture =
    document.kind === "devis" && document.status === "accepted" && !convertedFactureId;

  async function handleDownloadPdf() {
    if (pdfLoadingRef.current) return;
    pdfLoadingRef.current = true;
    setIsPdfLoading(true);
    try {
      const response = await fetchWithRefresh(
        `${env.apiBaseUrl}/billing-documents/${encodeURIComponent(document.id)}/pdf`
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const cd = response.headers.get("Content-Disposition");
      const filename = parseFilenameFromContentDisposition(
        cd,
        `${document.document_number}.pdf`
      );
      const blob = await response.blob();
      triggerBrowserDownload(blob, filename);
    } catch {
      toast.error(tErrors("pdfFailed"));
    } finally {
      setIsPdfLoading(false);
      pdfLoadingRef.current = false;
    }
  }

  async function handleDownloadXlsx() {
    if (xlsxLoadingRef.current) return;
    xlsxLoadingRef.current = true;
    setIsXlsxLoading(true);
    try {
      const response = await fetchWithRefresh(
        `${env.apiBaseUrl}/billing-documents/${encodeURIComponent(document.id)}/xlsx`
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const cd = response.headers.get("Content-Disposition");
      const filename = parseFilenameFromContentDisposition(
        cd,
        `${document.document_number}.xlsx`
      );
      const blob = await response.blob();
      triggerBrowserDownload(blob, filename);
    } catch {
      toast.error(tErrors("xlsxFailed"));
    } finally {
      setIsXlsxLoading(false);
      xlsxLoadingRef.current = false;
    }
  }

  async function handleConvertToFacture() {
    if (convertingRef.current) return;
    convertingRef.current = true;
    setIsConverting(true);
    try {
      const result = await convertDevisToFactureAction(document.id);
      if (!result.ok) {
        toast.error(
          result.error.code === "conflict"
            ? tErrors("alreadyConverted")
            : errorMessage(result.error, tErrors("convertFailed"))
        );
        return;
      }
      toast.success(tToast("devisConverted"));
      // Open the new facture. No onMutated(): its router.refresh() would
      // cancel this navigation and leave the user on the list.
      router.push(`/${locale}/billing/factures/${result.data.id}`);
    } catch {
      toast.error(tErrors("convertFailed"));
    } finally {
      setIsConverting(false);
      convertingRef.current = false;
    }
  }

  async function handleDelete() {
    if (deletingRef.current) return;
    deletingRef.current = true;
    try {
      const result = await deleteBillingDocumentAction(document.id);
      if (!result.ok) {
        toast.error(errorMessage(result.error, tErrors("deleteFailed")));
        // Deleted elsewhere: refresh so the stale row goes away.
        if (result.error.code === "not_found") onMutated();
        return;
      }
      toast.success(tToast("documentDeleted"));
      onMutated();
    } finally {
      deletingRef.current = false;
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            style={{ color: "var(--muted)" }}
            disabled={isPdfLoading || isXlsxLoading || isConverting}
          >
            {isPdfLoading || isXlsxLoading || isConverting ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <MoreHorizontal size={13} />
            )}
            <span className="sr-only">{tActions("openMenu")}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => router.push(editPath)}>
            <Pencil size={13} className="mr-2" />
            {tActions("edit")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setPreviewOpen(true)}>
            <Eye size={13} className="mr-2" />
            {tActions("previewPdf")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDownloadPdf} disabled={isPdfLoading}>
            <Download size={13} className="mr-2" />
            {tActions("downloadPdf")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDownloadXlsx} disabled={isXlsxLoading}>
            <FileSpreadsheet size={13} className="mr-2" />
            {tActions("downloadXlsx")}
          </DropdownMenuItem>
          {convertedFactureId && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => router.push(`/${locale}/billing/factures/${convertedFactureId}`)}
              >
                <ArrowRightLeft size={13} className="mr-2" />
                {tActions("openFacture")}
              </DropdownMenuItem>
            </>
          )}
          {showConvertToFacture && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleConvertToFacture}
                disabled={isConverting}
              >
                <ArrowRightLeft size={13} className="mr-2" />
                {tActions("convertToFacture")}
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setDeleteOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 size={13} className="mr-2" />
            {tActions("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <BillingDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        documentNumber={document.document_number}
        onConfirm={handleDelete}
      />

      <BillingPdfPreviewDialog
        document={previewOpen ? document : null}
        onClose={() => setPreviewOpen(false)}
      />
    </>
  );
}
