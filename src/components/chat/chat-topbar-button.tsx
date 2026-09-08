"use client";

/** Topbar chat button with the unread pill (the web counterpart of the mobile floating button). */

import { MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useChat } from "@/context/ChatContext";
import { ChatUnreadBadge } from "@/components/chat/chat-unread-badge";
import { CHAT_HREF } from "@/components/chat/chat-nav-link";

export function ChatTopbarButton() {
  const t = useTranslations("chat");
  const router = useRouter();
  const { enabled, unread } = useChat();
  if (enabled !== true) return null;
  return (
    <button
      type="button"
      className="btn btn-quiet relative"
      aria-label={unread > 0 ? `${t("open")} · ${t("unread", { count: unread })}` : t("open")}
      data-testid="chat-topbar-button"
      onClick={() => router.push(CHAT_HREF)}
    >
      <MessageCircle size={16} />
      <ChatUnreadBadge
        count={unread}
        className="absolute -right-1 -top-1 border-2"
        testId="chat-topbar-badge"
      />
    </button>
  );
}
