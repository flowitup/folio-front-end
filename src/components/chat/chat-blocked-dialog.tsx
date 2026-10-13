"use client";

/** People the caller blocked in chat, with an Unblock button each (App Store guideline 1.2). */

import { useTranslations } from "next-intl";
import type { BlockedUser } from "@/lib/api/chat-client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ChatBlockedDialog({
  open,
  onOpenChange,
  users,
  onUnblock,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: BlockedUser[];
  onUnblock: (userId: string) => void;
}) {
  const t = useTranslations("chat.moderation");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="z-[90] max-w-sm" overlayClassName="z-[90]" data-testid="chat-blocked-dialog">
        <DialogHeader>
          <DialogTitle>{t("blockedTitle")}</DialogTitle>
          <DialogDescription className="sr-only">{t("blockedTitle")}</DialogDescription>
        </DialogHeader>
        {users.length === 0 ? (
          <p className="py-4 text-center text-[13px]" style={{ color: "var(--muted)" }}>
            {t("none")}
          </p>
        ) : (
          <ul className="flex max-h-[50vh] flex-col overflow-y-auto">
            {users.map((user) => (
              <li
                key={user.id}
                className="flex items-center justify-between gap-3 border-b py-2.5 last:border-b-0"
                style={{ borderColor: "var(--line)" }}
              >
                <span className="min-w-0 flex-1 truncate text-[14px]">{user.name}</span>
                <button
                  type="button"
                  className="btn btn-quiet"
                  data-testid={`chat-unblock-${user.id}`}
                  onClick={() => onUnblock(user.id)}
                >
                  {t("unblock")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
