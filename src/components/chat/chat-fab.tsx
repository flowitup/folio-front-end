"use client";

/**
 * Floating chat button — bottom-right of every app page, the web counterpart of the
 * mobile app's FAB. Carries the total unread pill and deep-links to the selected
 * project's channel. Rendered only once the backend confirms the chat feature, and
 * not on /chat itself.
 *
 * Mounted in the (app) layout OUTSIDE the zoom:0.8 content wrapper: position:fixed
 * offsets inside the zoomed subtree rescale erratically. Sits above the mobile
 * bottom nav on narrow widths.
 */

import { MessageCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { useChat } from "@/context/ChatContext";
import { useProject } from "@/context/ProjectContext";
import { ChatUnreadBadge } from "@/components/chat/chat-unread-badge";

export const CHAT_HREF = "/chat";

export function ChatFab() {
  const t = useTranslations("chat");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { enabled, unread } = useChat();
  const { selectedProjectId } = useProject();

  const pathWithoutLocale = pathname.replace(new RegExp(`^/${locale}`), "") || "/";
  if (enabled !== true || pathWithoutLocale === CHAT_HREF) return null;

  const href = selectedProjectId
    ? `${CHAT_HREF}?channel=${encodeURIComponent(`project:${selectedProjectId}`)}`
    : CHAT_HREF;

  return (
    <button
      type="button"
      data-testid="chat-fab"
      aria-label={unread > 0 ? `${t("open")} · ${t("unread", { count: unread })}` : t("open")}
      onClick={() => router.push(href)}
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
