"use client";

/**
 * Chat drawer — the chat surface opened by the floating button, never a full page.
 *
 * Two shapes:
 *   - widget (desktop): a small Messenger-style window, 380 × 600 px, anchored above the
 *     floating button at the bottom right; no backdrop, the page stays usable; the button
 *     becomes the close toggle.
 *   - sheet (narrow viewports): full-screen.
 * Escape and the X close it in every shape; the panel unmounts on close so its 5 s thread
 * poll stops (the unsent draft is kept per channel in ChatContext). An Escape that a layer
 * inside the chat already handled (a message popover, a confirmation, the blocked-people
 * dialog: Radix marks it defaultPrevented) closes only that layer.
 *
 * Mounted in the (app) layout outside the zoom:0.8 content wrapper (fixed offsets inside
 * it rescale) and above the mobile bottom nav (z-50).
 */

import { useEffect } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useChat } from "@/context/ChatContext";
import { ChatPanel } from "@/components/chat/chat-panel";
import { useIsDesktop } from "@/hooks/use-is-desktop";

export type ChatDrawerShape = "widget" | "sheet";

const SHAPE_CLASS: Record<ChatDrawerShape, string> = {
  // Above the 52 px button (24 px margin + 52 px + 12 px gap = 88 px), capped by the viewport.
  widget:
    "fixed right-6 bottom-[88px] z-[70] flex w-[380px] max-w-[calc(100vw-48px)] h-[600px] max-h-[calc(100vh-112px)] flex-col overflow-hidden rounded-2xl border shadow-2xl",
  sheet: "fixed inset-0 z-[70] flex w-full flex-col",
};

export function ChatDrawer() {
  const t = useTranslations("chat");
  const { isOpen, requestedChannelKey, closeChat } = useChat();
  const isDesktop = useIsDesktop();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      closeChat();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, closeChat]);

  if (!isOpen) return null;
  const shape: ChatDrawerShape = isDesktop ? "widget" : "sheet";

  return (
    <>
      {shape !== "widget" ? (
        <div
          className="fixed inset-0 z-[60] bg-black/25"
          onClick={closeChat}
          aria-hidden="true"
          data-testid="chat-drawer-backdrop"
        />
      ) : null}
      <aside
        role="dialog"
        aria-modal={shape !== "widget"}
        aria-label={t("title")}
        data-testid="chat-drawer"
        data-shape={shape}
        className={SHAPE_CLASS[shape]}
        style={{ background: "var(--paper)", borderColor: "var(--line)" }}
      >
        <div
          className="flex items-center gap-1 border-b px-3 py-2"
          style={{ borderColor: "var(--line)" }}
        >
          <span className="label-cap flex-1 px-1">{t("title")}</span>
          <button
            type="button"
            className="btn btn-quiet"
            aria-label={t("close")}
            onClick={closeChat}
            data-testid="chat-drawer-close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1">
          <ChatPanel
            initialChannelKey={requestedChannelKey}
            layout="stack"
          />
        </div>
      </aside>
    </>
  );
}
