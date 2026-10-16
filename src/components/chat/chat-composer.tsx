"use client";

/**
 * Composer: photo picker (JPEG/PNG/WebP ≤ 10 MB, one at a time), a text area that grows with
 * its content (Enter sends, Shift+Enter starts a new line, 4 000 characters like the server),
 * send button. Client-side validation mirrors the backend limits so a bad pick is refused
 * before any upload.
 *
 * The draft lives in ChatContext per channel (`channelKey`): closing the chat window or
 * switching channels keeps it, and it never moves to another channel. The panel keys this
 * component by channel, so a channel switch remounts it with that channel's own draft.
 */

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { ImagePlus, Loader2, Send, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useChat } from "@/context/ChatContext";
import {
  CHAT_ATTACHMENT_TYPES,
  CHAT_MAX_ATTACHMENT_BYTES,
  CHAT_MAX_BODY_LENGTH,
} from "@/lib/api/chat-client";

/** Tallest the text area grows before it scrolls (about six lines). */
const MAX_INPUT_HEIGHT = 140;
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
  channelKey,
  disabled,
  sending,
  autoFocus = false,
  onSend,
  onReject,
}: {
  channelKey: string | null;
  disabled: boolean;
  sending: boolean;
  /** Focus the text area on mount (desktop: opening the chat lands in the composer). */
  autoFocus?: boolean;
  onSend: (input: { body: string; file: File | null }) => Promise<boolean>;
  onReject: (reason: ComposerRejection) => void;
}) {
  const t = useTranslations("chat");
  const { getDraft, setDraft: storeDraft } = useChat();
  const [draft, setDraftState] = useState(() => (channelKey ? getDraft(channelKey) : ""));
  const setDraft = (text: string) => {
    setDraftState(text);
    if (channelKey) storeDraft(channelKey, text);
  };
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  // Grow with the text up to MAX_INPUT_HEIGHT, then scroll.
  useLayoutEffect(() => {
    const node = textRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, MAX_INPUT_HEIGHT)}px`;
  }, [draft]);

  useEffect(() => {
    if (autoFocus && !disabled) textRef.current?.focus();
  }, [autoFocus, disabled]);

  const canSend = !disabled && !sending && (draft.trim().length > 0 || file !== null);

  async function submit() {
    if (!canSend) return;
    const ok = await onSend({ body: draft, file });
    if (ok) {
      setDraft("");
      setFile(null);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
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
    <div className="border-t" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
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
      <div className="flex items-end gap-1 px-2 py-2">
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
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[var(--chat-input)] disabled:opacity-50"
          style={{ color: "var(--chat-blue)" }}
          aria-label={t("attachImage")}
          disabled={disabled || sending}
          onClick={() => fileInputRef.current?.click()}
          data-testid="chat-attach"
        >
          <ImagePlus size={18} />
        </button>
        <textarea
          ref={textRef}
          rows={1}
          value={draft}
          disabled={disabled}
          placeholder={t("placeholder")}
          aria-label={t("placeholder")}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          maxLength={CHAT_MAX_BODY_LENGTH}
          data-testid="chat-input"
          className="block max-h-[140px] min-h-[38px] min-w-0 flex-1 resize-none rounded-[19px] border-0 px-4 py-[9px] text-[14.5px] leading-5 outline-none placeholder:text-[var(--muted)]"
          style={{ background: "var(--chat-input)", color: "var(--ink)" }}
        />
        <button
          type="button"
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-opacity disabled:opacity-40"
          style={{ color: "var(--chat-blue)" }}
          aria-label={t("send")}
          disabled={!canSend}
          onClick={() => void submit()}
          data-testid="chat-send"
        >
          {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={20} fill="currentColor" />}
        </button>
      </div>
    </div>
  );
}
