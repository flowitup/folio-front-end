"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { acceptInviteAsMeAction } from "@/lib/auth/actions";
import { errorMessageKey } from "./accept-invite-form";

interface JoinAsInviteeProps {
  token: string;
  locale: string;
  projectName: string;
  currentUser: string;
}

/**
 * The signed-in account IS the one this invitation was sent to (typically a
 * second invitation sent before the first was accepted): join straight from
 * the session, no sign-out and no phone step.
 */
export function JoinAsInvitee({ token, locale, projectName, currentUser }: JoinAsInviteeProps) {
  const t = useTranslations("acceptInvite");
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          {t("joinAsMe.body", { currentUser })}
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
          disabled={isJoining}
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
      </div>
    </div>
  );
}
