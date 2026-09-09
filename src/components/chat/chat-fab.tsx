"use client";

/**
 * Floating chat button — bottom-right of every app page, the web counterpart of the
 * mobile app's FAB. Carries the total unread pill and opens the chat drawer on the
 * selected project's channel. Rendered only once the backend confirms the chat feature,
 * and hidden while the drawer is open.
 *
 * Mounted in the (app) layout OUTSIDE the zoom:0.8 content wrapper: position:fixed
 * offsets inside the zoomed subtree rescale erratically. Sits above the mobile
 * bottom nav on narrow widths.
 */

import { MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useChat } from "@/context/ChatContext";
import { useProject } from "@/context/ProjectContext";
import { ChatUnreadBadge } from "@/components/chat/chat-unread-badge";

export function ChatFab() {
  const t = useTranslations("chat");
  const { enabled, unread, isOpen, openChat } = useChat();
  const { selectedProjectId } = useProject();

  if (enabled !== true || isOpen) return null;

  return (
    <button
      type="button"
      data-testid="chat-fab"
      aria-label={unread > 0 ? `${t("open")} · ${t("unread", { count: unread })}` : t("open")}
      onClick={() => openChat(selectedProjectId ? `project:${selectedProjectId}` : null)}
      // Narrow widths: clear the fixed bottom nav (≈56 px + safe area); desktop: 24 px from the corner.
      className="fixed right-4 bottom-[calc(72px+env(safe-area-inset-bottom,0px))] z-40 flex h-[52px] w-[52px] items-center justify-center rounded-full border transition-opacity hover:opacity-90 active:opacity-70 lg:right-6 lg:bottom-6"
      style={{
        background: "var(--card)",
        borderColor: "var(--line)",
        color: "var(--ink)",
        boxShadow: "0 10px 24px -10px rgba(26,26,26,0.35)",
      }}
    >
      <MessageCircle size={24} />
      <ChatUnreadBadge
        count={unread}
        className="absolute -right-1 -top-1 ring-2 ring-[var(--paper)]"
        testId="chat-fab-badge"
      />
    </button>
  );
}
