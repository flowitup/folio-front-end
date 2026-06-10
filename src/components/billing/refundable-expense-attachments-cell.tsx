"use client";

/**
 * Table cell for the "Invoice" column in the Refundable Invoices page.
 *
 * 0 files → muted em-dash (screen-reader label from i18n).
 * 1 file  → ghost button with filename → opens preview dialog.
 * >1 files → ghost button with count → dropdown listing filenames
 *            → clicking an item opens preview dialog.
 *
 * Uses InvoiceAttachmentPreviewDialog which already handles blob fetching,
 * PDF rendering, and download — no extra API wiring needed here.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InvoiceAttachmentPreviewDialog } from "@/components/invoices/invoice-attachment-preview-dialog";
import type { RefundableExpenseAttachment } from "@/types/invoice";

interface Props {
  attachments: RefundableExpenseAttachment[];
}

export function RefundableExpenseAttachmentsCell({ attachments }: Props) {
  const t = useTranslations("billing.refundable");
  // The currently previewed attachment; null means dialog is closed.
  const [selected, setSelected] = useState<RefundableExpenseAttachment | null>(null);

  if (attachments.length === 0) {
    return (
      <span
        className="text-muted-foreground text-sm"
        aria-label={t("attachments.none")}
        title={t("attachments.none")}
        aria-hidden
      >
        —
      </span>
    );
  }

  const singleFile = attachments.length === 1 ? attachments[0] : null;

  return (
    <>
      {singleFile ? (
        // Single attachment — show truncated filename as button label.
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 max-w-[140px] gap-1 text-sm font-normal"
          onClick={() => setSelected(singleFile)}
          title={singleFile.filename}
        >
          <Paperclip size={14} aria-hidden />
          <span className="truncate">{singleFile.filename}</span>
        </Button>
      ) : (
        // Multiple attachments — show count then list in a dropdown.
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 gap-1 text-sm font-normal"
            >
              <Paperclip size={14} aria-hidden />
              {t("attachments.count", { n: attachments.length })}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {attachments.map((att) => (
              <DropdownMenuItem
                key={att.id}
                onSelect={() => setSelected(att)}
                className="max-w-[220px]"
              >
                <span className="truncate">{att.filename}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <InvoiceAttachmentPreviewDialog
        attachment={selected}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
