"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, LogOut } from "lucide-react";
import { logout } from "@/lib/auth/actions";

interface LoggedInOtherProps {
  currentEmail: string;
}

export function LoggedInOther({ currentEmail }: LoggedInOtherProps) {
  const t = useTranslations("acceptInvite");
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await logout();
    } catch {
      // logout() calls redirect() which throws NEXT_REDIRECT — that's expected.
      // For any other error, reload to let the page re-evaluate session state.
      window.location.reload();
    }
  };

  return (
    <div
      className="grid min-h-screen place-items-center p-6"
      style={{ background: "var(--paper)" }}
    >
      <div className="w-full max-w-[400px] space-y-5 text-center">
        <h1 className="font-display text-[28px] font-medium tracking-tight">
          {t("loggedInOther.title")}
        </h1>

        <p className="text-[14px]" style={{ color: "var(--muted)" }}>
          {t("loggedInOther.body", { email: currentEmail })}
        </p>

        <button
          type="button"
          disabled={isSigningOut}
          onClick={handleSignOut}
          className="btn btn-primary mx-auto flex items-center gap-2"
          style={{ padding: "12px 20px", fontSize: 14 }}
        >
          {isSigningOut ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              {t("loggedInOther.signOut")}
            </>
          ) : (
            <>
              <LogOut size={14} />
              {t("loggedInOther.signOut")}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
