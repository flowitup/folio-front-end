"use client";

/**
 * BillingActionsMenu — `...` row action menu for billing documents.
 *
 * Items:
 *   - Edit → navigate to /billing/{kind}/{id}/edit
 *   - Download PDF → fetch PDF blob then trigger browser download
 *   - Convert to Facture → only rendered for devis with status=accepted
 *   - Delete → confirm then call server action
 */

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { MoreHorizontal, Pencil, Download, ArrowRightLeft, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { triggerBrowserDownload } from "@/lib/util/trigger-browser-download";
import { deleteBillingDocumentAction, convertDevisToFactureAction } from "@/app/[locale]/(app)/billing/_actions/billing-actions";
import { env } from "@/lib/config/env";
import { getApiAccessToken } from "@/lib/api/http";
import { parseFilenameFromContentDisposition } from "@/lib/api/_helpers/content-disposition";
import type { BillingDocument } from "@/types/billing";

interface BillingActionsMenuProps {
  document: BillingDocument;
  onMutated: () => void;
}

export function BillingActionsMenu({ document, onMutated }: BillingActionsMenuProps) {
  const router = useRouter();
  const locale = useLocale();
  const tActions = useTranslations("billing.form.actions");
  const tErrors = useTranslations("billing.form.errors");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [isConverting, setIsConverting] = useState(false);

  // Double-submit guards — synchronous check before React commit
  const pdfLoadingRef = useRef(false);
  const convertingRef = useRef(false);
  const deletingRef = useRef(false);

  const editPath = `/${locale}/billing/${document.kind}/${document.id}/edit`;

  const showConvertToFacture =
    document.kind === "devis" && document.status === "accepted";

  async function handleDownloadPdf() {
    if (pdfLoadingRef.current) return;
    pdfLoadingRef.current = true;
    setIsPdfLoading(true);
    try {
      const token = getApiAccessToken();
      const response = await fetch(
        `${env.apiBaseUrl}/billing-documents/${encodeURIComponent(document.id)}/pdf`,
        {
          method: "GET",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: "include",
        }
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

  async function handleConvertToFacture() {
    if (convertingRef.current) return;
    convertingRef.current = true;
    setIsConverting(true);
    try {
      const result = await convertDevisToFactureAction(document.id);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Devis converted to facture successfully.");
      // Navigate to the new facture
      router.push(`/${locale}/billing/factures`);
      onMutated();
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
        toast.error(result.error.message);
        return;
      }
      toast.success("Document deleted.");
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
            disabled={isPdfLoading || isConverting}
          >
            {isPdfLoading || isConverting ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <MoreHorizontal size={13} />
            )}
            <span className="sr-only">Open actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => router.push(editPath)}>
            <Pencil size={13} className="mr-2" />
            {tActions("edit") ?? "Edit"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDownloadPdf} disabled={isPdfLoading}>
            <Download size={13} className="mr-2" />
            {tActions("downloadPdf")}
          </DropdownMenuItem>
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
            className="text-red-600 focus:text-red-600"
          >
            <Trash2 size={13} className="mr-2" />
            {tActions("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <strong>{document.document_number}</strong>. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tActions("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {tActions("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
