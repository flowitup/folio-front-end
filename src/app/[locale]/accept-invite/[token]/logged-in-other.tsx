"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, LogOut } from "lucide-react";
import { logout } from "@/lib/auth/actions";

interface LoggedInOtherProps {
  currentEmail: string;
  /** This invitation's page, to come back to signed out. */
  returnPath: string;
}

export function LoggedInOther({ currentEmail, returnPath }: LoggedInOtherProps) {
  const t = useTranslations("acceptInvite");
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      // Signed out, the server sends the browser back to this invitation, not to /login.
      await logout(returnPath);
    } catch {
      // logout() ends in redirect(), which rejects here with NEXT_REDIRECT. Load
      // the invitation in full either way (also after any other error), so the
      // page renders for the signed-out visitor with no stale session state.
      window.location.assign(returnPath);
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
          {t("loggedInOther.body", { currentEmail })}
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
