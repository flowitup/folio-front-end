"use client";

/**
 * "Chat" navigation entry for the desktop sidebar and the mobile "More" sheet.
 * Self-gated: renders nothing until the backend confirms the chat feature, and carries
 * the total unread pill from ChatContext.
 */

import { MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { useChat } from "@/context/ChatContext";
import { ChatUnreadBadge } from "@/components/chat/chat-unread-badge";

export const CHAT_HREF = "/chat";

export function isChatPath(pathWithoutLocale: string): boolean {
  return pathWithoutLocale === CHAT_HREF || pathWithoutLocale.startsWith(`${CHAT_HREF}/`);
}

export function ChatNavLink({
  pathWithoutLocale,
  variant,
  onNavigate,
}: {
  pathWithoutLocale: string;
  variant: "sidebar" | "sheet";
  onNavigate?: () => void;
}) {
  const t = useTranslations("navigation");
  const { enabled, unread } = useChat();
  if (enabled !== true) return null;
  const active = isChatPath(pathWithoutLocale);

  if (variant === "sheet") {
    return (
      <Link
        prefetch={false}
        href={CHAT_HREF}
        onClick={onNavigate}
        data-testid="chat-nav-link"
        className={cn(
          "flex items-center gap-3 rounded-xl px-4 py-3 text-[14px] font-medium transition-colors",
          active
            ? "bg-[var(--paper-2)] text-[var(--accent)]"
            : "text-[var(--ink)] active:bg-[var(--paper-2)]"
        )}
      >
        <MessageCircle size={18} strokeWidth={active ? 2.2 : 1.8} />
        <span className="flex-1">{t("chat")}</span>
        <ChatUnreadBadge count={unread} />
      </Link>
    );
  }

  return (
    <Link
      prefetch={false}
      href={CHAT_HREF}
      data-testid="chat-nav-link"
      className={cn("nav-link", active && "active")}
    >
      <span className="nav-icon flex w-5 items-center justify-center">
        <MessageCircle size={16} />
      </span>
      <span className="flex-1 font-medium">{t("chat")}</span>
      <ChatUnreadBadge count={unread} />
    </Link>
  );
}
