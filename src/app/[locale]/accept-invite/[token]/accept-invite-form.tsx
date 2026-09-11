"use client";

import { useState, useEffect, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Loader2, AlertCircle, ArrowRight, Info } from "lucide-react";
import {
  acceptInviteAction,
  requestInviteCodeAction,
  type InviteFlowError,
} from "@/lib/auth/actions";
import { normalizeFrenchPhone } from "@/lib/auth/phone-number";
import type { VerifyInviteResponse } from "@/lib/auth/types";

// Matches the backend's resend-throttle window, so the countdown never lets the
// invitee tap "Resend" before the server would accept another request anyway.
const RESEND_COOLDOWN_SECONDS = 60;

interface AcceptInviteFormProps {
  token: string;
  locale: string;
  verified: VerifyInviteResponse;
}

/** Translation key under `acceptInvite.errors` for each backend failure. */
function errorMessageKey(error: InviteFlowError): string {
  switch (error) {
    case "invalid_phone":
      return "errors.invalidPhone";
    case "phone_registered":
      return "errors.phoneRegistered";
    case "invalid_code":
      return "errors.invalidCode";
    case "throttled":
      return "errors.throttled";
    case "expired":
      return "errors.expired";
    case "revoked":
      return "errors.revoked";
    case "accepted":
      return "errors.accepted";
    case "not_found":
      return "errors.notFound";
    default:
      return "errors.generic";
  }
}

/**
 * Accept an invitation by proving a phone number with an SMS code.
 *
 * The invitee no longer chooses a password: phone + code is the only way into
 * Folio, so the account created here must be one they can sign back into. The
 * invited email stays on the account as contact information and is shown
 * read-only so they can see which invitation they are accepting.
 */
export function AcceptInviteForm({ token, locale, verified }: AcceptInviteFormProps) {
  const t = useTranslations("acceptInvite");

  const [step, setStep] = useState<"details" | "code">("details");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  // E.164 form of the number the code was sent to — what the code step shows and verifies.
  const [normalizedPhone, setNormalizedPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Countdown ticker for the "Resend in {n}s" button label.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const sendCode = async (e164: string): Promise<boolean> => {
    setIsSendingCode(true);
    try {
      const result = await requestInviteCodeAction(token, e164);
      if (!result.success) {
        setError(t(errorMessageKey(result.error ?? "unknown")));
        return false;
      }
      setCooldown(RESEND_COOLDOWN_SECONDS);
      return true;
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleDetailsSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (trimmedName.length < 1 || trimmedName.length > 100) {
      setError(t("errors.generic"));
      return;
    }
    const trimmedPhone = phone.trim();
    if (!trimmedPhone) {
      setError(t("errors.phoneRequired"));
      return;
    }
    // Codes go out through a French gateway: refuse anything else here, before
    // the request, so the invitee sees why instead of a generic failure.
    const french = normalizeFrenchPhone(trimmedPhone);
    if (!french) {
      setError(t("errors.invalidPhone"));
      return;
    }

    if (await sendCode(french)) {
      setNormalizedPhone(french);
      setStep("code");
    }
  };

  const handleResend = async () => {
    setError(null);
    await sendCode(normalizedPhone);
  };

  const handleChangeNumber = () => {
    setStep("details");
    setNormalizedPhone("");
    setCode("");
    setError(null);
    setCooldown(0);
  };

  const handleCodeSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedCode = code.trim();
    if (!/^\d{6}$/.test(trimmedCode)) {
      setError(t("errors.codeRequired"));
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await acceptInviteAction(token, name.trim(), normalizedPhone, trimmedCode);
      if (!result.success) {
        setError(t(errorMessageKey(result.error ?? "unknown")));
        return;
      }
      // Cookies are set server-side; a full navigation triggers fresh SSR with auth context.
      window.location.href = `/${locale}/dashboard`;
    } catch {
      setError(t("errors.generic"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const errorBanner = error ? (
    <div
      className="flex items-start gap-2 rounded-[10px] p-3 text-[12.5px]"
      style={{
        background: "var(--negative-tint)",
        color: "#8a3924",
        border: "1px solid #e6c0ad",
      }}
    >
      <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
      <span>{error}</span>
    </div>
  ) : null;

  const detailsStep = (
    <form className="mt-6 space-y-4" onSubmit={handleDetailsSubmit}>
      {errorBanner}

      {/* Email — read-only: which invitation this is, not a credential. */}
      <div>
        <label htmlFor="email" className="label-cap">
          {t("emailLabel")}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          readOnly
          value={verified.email}
          className="folio-input mt-1"
          style={{ opacity: 0.7, cursor: "default" }}
        />
      </div>

      <div>
        <label htmlFor="name" className="label-cap">
          {t("nameLabel")}
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          required
          minLength={1}
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isSendingCode}
          className="folio-input mt-1"
        />
      </div>

      <div>
        <label htmlFor="phone" className="label-cap">
          {t("phoneLabel")}
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={isSendingCode}
          placeholder={t("phonePlaceholder")}
          className="folio-input mt-1"
        />
        <p className="mt-1 text-[12px]" style={{ color: "var(--muted)" }}>
          {t("phoneHint")}
        </p>
      </div>

      <button
        type="submit"
        disabled={isSendingCode}
        className="btn btn-primary w-full"
        style={{ padding: "12px 16px", fontSize: 14 }}
      >
        {isSendingCode ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            {t("sendingCode")}
          </>
        ) : (
          <>
            {t("sendCode")} <ArrowRight size={14} />
          </>
        )}
      </button>
    </form>
  );

  const codeStep = (
    <form className="mt-6 space-y-4" onSubmit={handleCodeSubmit}>
      {errorBanner}

      <p className="text-[13px]" style={{ color: "var(--muted)" }}>
        {t("codeSentTo", { phone: normalizedPhone })}
      </p>

      <div>
        <label htmlFor="code" className="label-cap">
          {t("codeLabel")}
        </label>
        <input
          id="code"
          name="code"
          type="text"
          autoComplete="one-time-code"
          inputMode="numeric"
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          disabled={isSubmitting}
          placeholder={t("codePlaceholder")}
          className="folio-input mt-1"
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="btn btn-primary w-full"
        style={{ padding: "12px 16px", fontSize: 14 }}
      >
        {isSubmitting ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            {t("submitting")}
          </>
        ) : (
          <>
            {t("submit")} <ArrowRight size={14} />
          </>
        )}
      </button>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleChangeNumber}
          disabled={isSubmitting}
          className="text-[13px] underline"
          style={{ color: "var(--muted)" }}
        >
          {t("changeNumber")}
        </button>
        <button
          type="button"
          onClick={handleResend}
          disabled={isSendingCode || isSubmitting || cooldown > 0}
          className="text-[13px] underline disabled:no-underline disabled:opacity-60"
          style={{ color: "var(--muted)" }}
        >
          {cooldown > 0 ? t("resendIn", { seconds: cooldown }) : t("resendCode")}
        </button>
      </div>
    </form>
  );

  return <Shell locale={locale} verified={verified} t={t}>{step === "details" ? detailsStep : codeStep}</Shell>;
}

interface ShellProps {
  locale: string;
  verified: VerifyInviteResponse;
  t: ReturnType<typeof useTranslations>;
  children: ReactNode;
}

/** Page chrome shared by both steps so the invitee keeps their context while moving between them. */
function Shell({ locale, verified, t, children }: ShellProps) {
  return (
    <div className="grid min-h-screen grid-cols-12">
      {/* Left — form column */}
      <div
        className="col-span-12 flex flex-col p-10 lg:col-span-5"
        style={{ background: "var(--paper)" }}
      >
        <div className="m-auto w-full max-w-[380px]">
          <h1 className="font-display text-[32px] font-medium leading-[1.1] tracking-tight">
            {t("title", { projectName: verified.project_name })}
          </h1>
          <p className="mt-2 text-[14px]" style={{ color: "var(--muted)" }}>
            {t("intro")}
          </p>

          {/* Invite banner */}
          <div
            className="mt-5 flex items-start gap-2 rounded-[10px] p-3 text-[12.5px]"
            style={{
              background: "var(--accent-tint, #f5ede5)",
              color: "var(--accent-ink, #7c4a1e)",
              border: "1px solid var(--accent-border, #ddc4ab)",
            }}
          >
            <Info size={14} className="mt-0.5 flex-shrink-0" />
            <span>
              {t("subtitle", {
                inviterName: verified.inviter_name,
                roleName: verified.role_name,
              })}
            </span>
          </div>

          {children}

          <p className="mt-6 text-[12px]" style={{ color: "var(--muted)" }}>
            <a
              href={`/${locale}/login`}
              style={{
                color: "var(--accent-ink)",
                textDecoration: "underline",
                textUnderlineOffset: 3,
              }}
            >
              {t("backToLogin")}
            </a>
          </p>
        </div>
      </div>

      {/* Right — decorative panel */}
      <div
        className="relative col-span-7 hidden overflow-hidden lg:flex"
        style={{
          background: "linear-gradient(135deg, #d8b896 0%, #b8845f 60%, #5b3a1f 100%)",
        }}
      >
        <div className="blueprint-grid absolute inset-0 opacity-25" />
        <div className="paper-noise absolute inset-0" />
      </div>
    </div>
  );
}
