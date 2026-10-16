"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, ArrowRight, Loader2, LogOut } from "lucide-react";
import { acceptInviteAsMeAction, logout } from "@/lib/auth/actions";
import { queueFlashToast } from "@/lib/flash-toast";
import { rememberSelectedProject } from "@/lib/selected-project";
import { errorMessageKey } from "./accept-invite-form";

interface JoinAsInviteeProps {
  token: string;
  locale: string;
  projectName: string;
  currentUser: string;
  /** The session's e-mail is the invited one (else: a phone-only or other account). */
  isInvitee?: boolean;
  /** This invitation's page, to come back to signed out ("use another account"). */
  returnPath?: string;
}

/**
 * A signed-in visitor joins straight from the session, no sign-out and no
 * phone step: the invitation token is the authorisation (it already lets an
 * unknown phone create an account), so this works for the invited account and
 * for anyone else signed in, typically a worker who signed up on mobile with a
 * phone only. "Use another account" signs out and comes back to this link.
 */
export function JoinAsInvitee({
  token,
  locale,
  projectName,
  currentUser,
  isInvitee = true,
  returnPath,
}: JoinAsInviteeProps) {
  const t = useTranslations("acceptInvite");
  const [isJoining, setIsJoining] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSwitchAccount = async () => {
    if (!returnPath) return;
    setIsSigningOut(true);
    try {
      // Signed out, the server sends the browser back to this invitation, not to /login.
      await logout(returnPath);
    } catch {
      // logout() ends in redirect(), which rejects here with NEXT_REDIRECT. Load
      // the invitation in full either way so it renders for the signed-out visitor.
      window.location.assign(returnPath);
    }
  };

  const handleJoin = async () => {
    setError(null);
    setIsJoining(true);
    try {
      const result = await acceptInviteAsMeAction(token);
      if (!result.success) {
        setError(t(errorMessageKey(result.error ?? "unknown")));
        setIsJoining(false);
        return;
      }
      // Open on the project just joined, not the one this browser viewed last.
      rememberSelectedProject(result.projectId);
      queueFlashToast(t("joinedToast", { projectName }));
      // A full navigation so every server component re-reads the new membership.
      window.location.href = `/${locale}/dashboard`;
    } catch {
      setError(t("errors.generic"));
      setIsJoining(false);
    }
  };

  return (
    <div
      className="grid min-h-screen place-items-center p-6"
      style={{ background: "var(--paper)" }}
    >
      <div className="w-full max-w-[400px] space-y-5 text-center">
        <h1 className="font-display text-[28px] font-medium tracking-tight">
          {t("joinAsMe.title", { projectName })}
        </h1>

        <p className="text-[14px]" style={{ color: "var(--muted)" }}>
          {isInvitee ? t("joinAsMe.body", { currentUser }) : t("joinAsMe.bodyOther", { currentUser })}
        </p>

        {error ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-[10px] p-3 text-left text-[12.5px]"
            style={{
              background: "var(--negative-tint)",
              color: "#8a3924",
              border: "1px solid #e6c0ad",
            }}
          >
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <button
          type="button"
          disabled={isJoining || isSigningOut}
          onClick={handleJoin}
          className="btn btn-primary mx-auto flex items-center gap-2"
          style={{ padding: "12px 20px", fontSize: 14 }}
        >
          {isJoining ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              {t("joinAsMe.submitting")}
            </>
          ) : (
            <>
              {t("joinAsMe.submit")} <ArrowRight size={14} />
            </>
          )}
        </button>

        {returnPath ? (
          <button
            type="button"
            disabled={isJoining || isSigningOut}
            onClick={handleSwitchAccount}
            className="mx-auto flex items-center gap-1.5 text-[13px] underline disabled:opacity-60"
            style={{ color: "var(--muted)" }}
          >
            {isSigningOut ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />}
            {t("joinAsMe.switchAccount")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
