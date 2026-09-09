"use client";

/**
 * Chat drawer — slides in from the right over the app (never a full page). Compact by
 * default (thread + channel chips, 440 px); "Expand" widens it to a split view with the
 * channel list. Full-width on narrow viewports. Backdrop click and Escape close it; the
 * panel unmounts on close so its 5 s thread poll stops.
 *
 * Mounted in the (app) layout outside the zoom:0.8 content wrapper (fixed offsets inside
 * it rescale) and above the mobile bottom nav (z-50).
 */

import { useEffect, useState } from "react";
import { Maximize2, Minimize2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useChat } from "@/context/ChatContext";
import { ChatPanel } from "@/components/chat/chat-panel";
import { useIsDesktop } from "@/hooks/use-is-desktop";

export function ChatDrawer() {
  const t = useTranslations("chat");
  const { isOpen, requestedChannelKey, closeChat } = useChat();
  const [expanded, setExpanded] = useState(false);
  const isDesktop = useIsDesktop();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeChat();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, closeChat]);

  if (!isOpen) return null;
  const split = isDesktop && expanded;

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/25"
        onClick={closeChat}
        aria-hidden="true"
        data-testid="chat-drawer-backdrop"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t("title")}
        data-testid="chat-drawer"
        data-expanded={split ? "true" : "false"}
        className="fixed inset-y-0 right-0 z-[70] flex w-full flex-col border-l shadow-2xl transition-[width] duration-200 lg:w-[440px] data-[expanded=true]:lg:w-[860px]"
        style={{ background: "var(--paper)", borderColor: "var(--line)" }}
      >
        <div
          className="flex items-center gap-1 border-b px-3 py-2"
          style={{ borderColor: "var(--line)" }}
        >
          <span className="label-cap flex-1 px-1">{t("title")}</span>
          {isDesktop ? (
            <button
              type="button"
              className="btn btn-quiet"
              aria-label={expanded ? t("collapse") : t("expand")}
              aria-pressed={expanded}
              onClick={() => setExpanded((value) => !value)}
              data-testid="chat-drawer-expand"
            >
              {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          ) : null}
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
          <ChatPanel initialChannelKey={requestedChannelKey} layout={split ? "split" : "stack"} />
        </div>
      </aside>
    </>
  );
}
