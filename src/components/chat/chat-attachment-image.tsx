"use client";

/**
 * Image attachment of a message, fetched as an authenticated blob (photo-thumb pattern):
 * skeleton while loading, revoked on unmount. Clicking opens the picture in an in-app viewer
 * with a Download button that saves it under its real file name. (A new tab on the blob: URL
 * had a UUID for a name and died as soon as the chat closed.)
 */

import { useEffect, useRef, useState } from "react";
import { Download, ImageIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { fetchChatAttachmentBlob, type ChatAttachment } from "@/lib/api/chat-client";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export function formatAttachmentSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function ChatAttachmentImage({
  messageId,
  attachment,
}: {
  messageId: string;
  attachment: ChatAttachment;
}) {
  const t = useTranslations("chat");
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const revokeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    fetchChatAttachmentBlob(messageId, controller.signal)
      .then((blob) => {
        if (cancelled) {
          blob.revoke();
          return;
        }
        revokeRef.current = blob.revoke;
        setObjectUrl(blob.objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      controller.abort();
      revokeRef.current?.();
      revokeRef.current = null;
    };
  }, [messageId]);

  return (
    <div
      className="w-[220px] overflow-hidden rounded-[14px] border"
      style={{ background: "var(--card)", borderColor: "var(--line)" }}
      data-testid="chat-attachment"
    >
      <div
        className="relative flex h-[140px] items-center justify-center"
        style={{ background: "var(--paper-2)" }}
      >
        <ImageIcon size={28} style={{ color: "var(--muted)" }} aria-hidden="true" />
        {objectUrl && !failed ? (
          <button
            type="button"
            className="absolute inset-0 cursor-zoom-in focus-visible:outline-2"
            aria-label={t("openImage", { name: attachment.filename })}
            data-testid="chat-attachment-open"
            onClick={() => setViewerOpen(true)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- blob: URL, not an optimisable asset */}
            <img
              src={objectUrl}
              alt={attachment.filename}
              className="h-full w-full object-cover"
            />
          </button>
        ) : null}
      </div>
      <div className="num truncate px-2.5 py-1.5 text-[11px]" style={{ color: "var(--muted)" }}>
        {attachment.filename} · {formatAttachmentSize(attachment.size_bytes)}
      </div>
      {objectUrl ? (
        <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
          <DialogContent
            className="z-[90] flex max-h-[calc(100vh-2rem)] w-auto max-w-[calc(100vw-2rem)] flex-col gap-3 p-4 sm:max-w-[min(960px,calc(100vw-2rem))]"
            overlayClassName="z-[90]"
            data-testid="chat-image-viewer"
            // The image and its file name say it all: no description to point at.
            aria-describedby={undefined}
          >
            <DialogTitle className="truncate pr-8 text-[14px] font-medium">{attachment.filename}</DialogTitle>
            {/* eslint-disable-next-line @next/next/no-img-element -- blob: URL, not an optimisable asset */}
            <img
              src={objectUrl}
              alt={attachment.filename}
              className="min-h-0 max-h-[calc(100vh-10rem)] w-auto max-w-full self-center object-contain"
            />
            <a
              href={objectUrl}
              download={attachment.filename}
              className="btn btn-quiet inline-flex items-center gap-1.5 self-end"
              data-testid="chat-image-download"
            >
              <Download size={14} aria-hidden="true" />
              {t("downloadImage")}
            </a>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
