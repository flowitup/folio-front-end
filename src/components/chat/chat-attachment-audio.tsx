"use client";

/**
 * Voice note of a message, fetched as an authenticated blob like the image attachment:
 * skeleton while loading, revoked on unmount. Played by the browser's own audio control,
 * which brings the scrubber, the volume and the keyboard handling for free.
 */

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Mic } from "lucide-react";
import { fetchChatAttachmentBlob, type ChatAttachment } from "@/lib/api/chat-client";
import { formatAttachmentSize } from "@/components/chat/chat-attachment-image";

export function ChatAttachmentAudio({
  messageId,
  attachment,
}: {
  messageId: string;
  attachment: ChatAttachment;
}) {
  const t = useTranslations("chat");
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
      className="w-[260px] overflow-hidden rounded-[14px] border"
      style={{ background: "var(--card)", borderColor: "var(--line)" }}
      data-testid="chat-attachment-audio"
    >
      <div className="flex items-center gap-2 px-2.5 pt-2">
        <Mic size={14} style={{ color: "var(--muted)" }} aria-hidden="true" />
        <span className="text-[11px]" style={{ color: "var(--muted)" }}>
          {t("voiceNote")}
        </span>
      </div>
      {objectUrl && !failed ? (
        <audio
          src={objectUrl}
          controls
          preload="metadata"
          className="h-9 w-full px-1.5 py-1"
          aria-label={attachment.filename}
          data-testid="chat-attachment-audio-player"
        />
      ) : (
        <div
          className="px-2.5 py-2 text-[11px]"
          style={{ color: failed ? "var(--negative)" : "var(--muted-2)" }}
        >
          {failed ? t("voiceLoadFailed") : t("voiceLoading")}
        </div>
      )}
      <div className="num truncate px-2.5 pb-1.5 text-[11px]" style={{ color: "var(--muted)" }}>
        {attachment.filename} · {formatAttachmentSize(attachment.size_bytes)}
      </div>
    </div>
  );
}
