import type { ReactNode } from "react";
import { LanguageSwitcher } from "@/components/language-switcher";

/**
 * The invitee is signed out and has no topbar yet, so the language control
 * sits in the corner of every invitation screen (form, code step, errors).
 */
export default function AcceptInviteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      <div
        className="absolute right-4 top-4 z-10 rounded-[10px]"
        style={{ background: "var(--paper)" }}
      >
        <LanguageSwitcher />
      </div>
      {children}
    </div>
  );
}
