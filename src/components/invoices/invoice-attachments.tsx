"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Upload, X, FileText, Image as ImageIcon, Download, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  fetchAttachments,
  uploadAttachment,
  deleteAttachment,
  fetchAttachmentBlobUrl,
} from "@/lib/api/invoice-api";
import type { Invoice, InvoiceAttachment } from "@/types/invoice";
import { InvoiceAttachmentPreviewDialog } from "./invoice-attachment-preview-dialog";

const ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];
const MAX_BYTES = 10 * 1024 * 1024;

interface InvoiceAttachmentsProps {
  invoice: Invoice;
  canManage: boolean;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageMime(mime: string): boolean {
  return mime.startsWith("image/");
}

export function InvoiceAttachments({ invoice, canManage }: InvoiceAttachmentsProps) {
  const t = useTranslations("invoices");
  const [attachments, setAttachments] = useState<InvoiceAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<InvoiceAttachment | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAttachments(invoice.project_id, invoice.id);
      setAttachments(data);
    } catch {
      setError(t("attachmentsLoadError"));
    } finally {
      setLoading(false);
    }
  }, [invoice.project_id, invoice.id, t]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchAttachments(invoice.project_id, invoice.id)
      .then((data) => { if (!cancelled) setAttachments(data); })
      .catch(() => { if (!cancelled) setError(t("attachmentsLoadError")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [invoice.project_id, invoice.id, t]);

  const validateAndUpload = async (files: FileList | File[]) => {
    setError(null);
    const list = Array.from(files);
    for (const file of list) {
      if (file.size > MAX_BYTES) {
        setError(t("fileTooLarge", { name: file.name }));
        continue;
      }
      if (!ALLOWED_MIME.includes(file.type)) {
        setError(t("invalidFileType", { name: file.name }));
        continue;
      }
      setUploading(true);
      try {
        await uploadAttachment(invoice.project_id, invoice.id, file);
      } catch {
        setError(t("uploadFailed", { name: file.name }));
      } finally {
        setUploading(false);
      }
    }
    await reload();
  };

  const handleDelete = async (attachmentId: string) => {
    if (!confirm(t("attachmentDeleteConfirm"))) return;
    try {
      await deleteAttachment(attachmentId);
      await reload();
    } catch {
      setError(t("deleteFailed"));
    }
  };

  return (
    <Card>
      <CardContent className="p-0">
        <div className="px-6 py-4 border-b">
          <h3 className="text-sm font-semibold">{t("attachments")}</h3>
        </div>

        {/* Upload zone (only for users who can manage) */}
        {canManage && (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files.length) validateAndUpload(e.dataTransfer.files);
            }}
            className={`m-4 border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/30"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ALLOWED_MIME.join(",")}
              className="hidden"
              onChange={(e) => { if (e.target.files?.length) validateAndUpload(e.target.files); e.target.value = ""; }}
              disabled={uploading}
            />
            <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-2">{t("dragDropHint")}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" />{t("uploading")}</>
              ) : (
                t("chooseFiles")
              )}
            </Button>
            <p className="text-xs text-muted-foreground mt-2">{t("attachmentLimits")}</p>
          </div>
        )}

        {error && <div className="px-6 py-2 text-xs text-destructive">{error}</div>}

        {/* List */}
        <div className="px-6 pb-4">
          {loading ? (
            <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
          ) : attachments.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">{t("noAttachments")}</div>
          ) : (
            <ul className="space-y-2">
              {attachments.map((att) => (
                <AttachmentRow
                  key={att.id}
                  attachment={att}
                  canDelete={canManage}
                  onDelete={() => handleDelete(att.id)}
                  onPreview={() => setPreviewAttachment(att)}
                />
              ))}
            </ul>
          )}
        </div>
      </CardContent>
      <InvoiceAttachmentPreviewDialog
        attachment={previewAttachment}
        onClose={() => setPreviewAttachment(null)}
      />
    </Card>
  );
}

interface AttachmentRowProps {
  attachment: InvoiceAttachment;
  canDelete: boolean;
  onDelete: () => void;
  onPreview: () => void;
}

function AttachmentRow({ attachment, canDelete, onDelete, onPreview }: AttachmentRowProps) {
  const t = useTranslations("invoices");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const isImage = isImageMime(attachment.mime_type);

  // Lazy-load image preview as a blob URL (auth header is required for download)
  useEffect(() => {
    if (!isImage) return;
    let revoked = false;
    let url: string | null = null;
    fetchAttachmentBlobUrl(attachment.id)
      .then((u) => { if (!revoked) { url = u; setPreviewUrl(u); } })
      .catch(() => { /* swallow — fall back to text-only row */ });
    return () => {
      revoked = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [attachment.id, isImage]);

  const handleDownload = async () => {
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
      /* swallow — row stays usable */
    }
  };

  return (
    <li
      className="flex items-center gap-3 rounded-md border bg-card px-3 py-2 cursor-pointer hover:bg-accent/50 transition-colors"
      onClick={onPreview}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPreview(); } }}
    >
      <div className="shrink-0">
        {isImage && previewUrl ? (
          <img
            src={previewUrl}
            alt={attachment.filename}
            className="h-12 w-12 rounded object-cover border"
          />
        ) : isImage ? (
          <ImageIcon className="h-12 w-12 text-muted-foreground p-2" />
        ) : (
          <FileText className="h-12 w-12 text-muted-foreground p-2" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{attachment.filename}</p>
        <p className="text-xs text-muted-foreground">
          {formatBytes(attachment.size_bytes)} · {new Date(attachment.uploaded_at).toLocaleDateString()}
        </p>
      </div>

      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onPreview(); }} title={t("attachmentPreview.preview")}>
        <Eye className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDownload(); }} title={t("openAttachment")}>
        <Download className="h-4 w-4" />
      </Button>
      {canDelete && (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="text-muted-foreground hover:text-destructive"
          title={t("delete")}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </li>
  );
}
