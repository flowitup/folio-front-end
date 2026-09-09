"use client";

/**
 * Image attachment of a message, fetched as an authenticated blob (photo-thumb pattern):
 * skeleton while loading, revoked on unmount. Clicking opens the full image in a new tab.
 */

import { useEffect, useRef, useState } from "react";
import { ImageIcon } from "lucide-react";
import { fetchChatAttachmentBlob, type ChatAttachment } from "@/lib/api/chat-client";

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
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
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
          <a
            href={objectUrl}
            target="_blank"
            rel="noreferrer"
            className="absolute inset-0"
            aria-label={attachment.filename}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- blob: URL, not an optimisable asset */}
            <img
              src={objectUrl}
              alt={attachment.filename}
              className="h-full w-full object-cover"
            />
          </a>
        ) : null}
      </div>
      <div className="num truncate px-2.5 py-1.5 text-[11px]" style={{ color: "var(--muted)" }}>
        {attachment.filename} · {formatAttachmentSize(attachment.size_bytes)}
      </div>
    </div>
  );
}
