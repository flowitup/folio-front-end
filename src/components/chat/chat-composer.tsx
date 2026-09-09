"use client";

/**
 * Composer: photo picker (JPEG/PNG/WebP ≤ 10 MB, one at a time), single-line input
 * (Enter sends), send button. Client-side validation mirrors the backend limits so a
 * bad pick is refused before any upload.
 */

import { useRef, useState, type KeyboardEvent } from "react";
import { ImagePlus, Loader2, Send, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { CHAT_ATTACHMENT_TYPES, CHAT_MAX_ATTACHMENT_BYTES } from "@/lib/api/chat-client";
import { withInferredContentType } from "@/lib/media/infer-content-type";

export type ComposerRejection = "tooLarge" | "unsupportedType";

/** Why a picked file cannot be sent, or null when acceptable (call after `withInferredContentType`). */
export function rejectAttachment(file: File): ComposerRejection | null {
  if (!(CHAT_ATTACHMENT_TYPES as readonly string[]).includes(file.type) || file.size === 0)
    return "unsupportedType";
  if (file.size > CHAT_MAX_ATTACHMENT_BYTES) return "tooLarge";
  return null;
}

export function ChatComposer({
  disabled,
  sending,
  onSend,
  onReject,
}: {
  disabled: boolean;
  sending: boolean;
  onSend: (input: { body: string; file: File | null }) => Promise<boolean>;
  onReject: (reason: ComposerRejection) => void;
}) {
  const t = useTranslations("chat");
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSend = !disabled && !sending && (draft.trim().length > 0 || file !== null);

  async function submit() {
    if (!canSend) return;
    const ok = await onSend({ body: draft, file });
    if (ok) {
      setDraft("");
      setFile(null);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    }
  }

  function onPick(picked: File | undefined) {
    if (!picked) return;
    // Camera / AirDrop files can arrive with an empty MIME type — re-tag from the extension
    // (same helper as photo uploads) before validating, so real photos are not refused.
    const normalized = withInferredContentType(picked);
    const reason = rejectAttachment(normalized);
    if (reason) {
      onReject(reason);
      return;
    }
    setFile(normalized);
  }

  return (
    <div className="border-t" style={{ borderColor: "var(--line)", background: "var(--paper)" }}>
      {file ? (
        <div
          className="flex items-center gap-2 border-b px-4 py-2 text-[12px]"
          style={{ borderColor: "var(--line)", color: "var(--muted)" }}
        >
          <ImagePlus size={14} aria-hidden="true" />
          <span className="num min-w-0 flex-1 truncate" data-testid="chat-composer-file">
            {file.name}
          </span>
          <button
            type="button"
            className="btn btn-quiet h-7 w-7 p-0"
            aria-label={t("removeImage")}
            onClick={() => setFile(null)}
            data-testid="chat-remove-file"
          >
            <X size={14} />
          </button>
        </div>
      ) : null}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <input
          ref={fileInputRef}
          type="file"
          accept={CHAT_ATTACHMENT_TYPES.join(",")}
          className="hidden"
          data-testid="chat-file-input"
          onChange={(event) => {
            onPick(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <button
          type="button"
          className="btn btn-quiet"
          aria-label={t("attachImage")}
          disabled={disabled || sending}
          onClick={() => fileInputRef.current?.click()}
          data-testid="chat-attach"
        >
          <ImagePlus size={18} />
        </button>
        <input
          type="text"
          value={draft}
          disabled={disabled}
          placeholder={t("placeholder")}
          aria-label={t("placeholder")}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          maxLength={4000}
          data-testid="chat-input"
          className="h-[42px] min-w-0 flex-1 rounded-full border px-4 text-[14px] outline-none focus:shadow-[var(--shadow-focus)]"
          style={{ background: "var(--card)", borderColor: "var(--line-2)", color: "var(--ink)" }}
        />
        <button
          type="button"
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-white transition-opacity disabled:opacity-50"
          style={{ background: "var(--positive)" }}
          aria-label={t("send")}
          disabled={!canSend}
          onClick={() => void submit()}
          data-testid="chat-send"
        >
          {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </div>
    </div>
  );
}
