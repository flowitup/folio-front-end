"use client";

import { useState, useEffect, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Loader2, AlertCircle, ArrowRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { requestOtpAction, type RequestOtpError } from "@/lib/auth/otp-actions";
import { normalizeFrenchPhone } from "@/lib/auth/phone-number";

// Matches the backend's resend-throttle window (`resend_after_seconds`) so
// the client-side countdown never lets the user tap "Resend" before the
// server would accept another request anyway.
const RESEND_COOLDOWN_SECONDS = 60;

interface PhoneLoginFormProps {
  /** Rendered under the phone-entry step only — used by LoginForm in "both"
   * mode to offer "Sign in with email instead". */
  useEmailInsteadSlot?: ReactNode;
}

function requestErrorMessageKey(error: RequestOtpError): string {
  switch (error) {
    case "invalid_phone":
      return "errorInvalidPhone";
    case "throttled":
      return "errorThrottled";
    case "sms_failed":
      return "errorSmsFailed";
    case "unavailable":
    case "unknown":
    default:
      return "errorPhoneLoginUnavailable";
  }
}

export function PhoneLoginForm({ useEmailInsteadSlot }: PhoneLoginFormProps) {
  const { loginWithPhone, isLoading } = useAuth();
  const t = useTranslations("auth");

  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  // E.164 form of the number the code was sent to — what the code step shows and verifies.
  const [normalizedPhone, setNormalizedPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  // requestOtpAction is a plain server action, not wired into AuthContext,
  // so it needs its own pending flag distinct from useAuth().isLoading
  // (which only tracks login / loginWithPhone).
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Countdown ticker for the "Resend in {n}s" button label.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const sendCode = async (phoneNumber: string): Promise<boolean> => {
    setIsSendingCode(true);
    const result = await requestOtpAction(phoneNumber);
    setIsSendingCode(false);
    if (!result.success) {
      setError(t(requestErrorMessageKey(result.error)));
      return false;
    }
    setCooldown(RESEND_COOLDOWN_SECONDS);
    return true;
  };

  const handlePhoneSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = phone.trim();
    if (!trimmed) {
      setError(t("errorPhoneRequired"));
      return;
    }
    // Sign-in codes go out through a French gateway: refuse anything else here,
    // before the request, so the user sees why instead of a generic failure.
    const french = normalizeFrenchPhone(trimmed);
    if (!french) {
      setError(t("errorInvalidPhone"));
      return;
    }
    const ok = await sendCode(french);
    if (ok) {
      setNormalizedPhone(french);
      setStep("code");
    }
  };

  const handleResend = async () => {
    setError(null);
    await sendCode(normalizedPhone);
  };

  const handleChangeNumber = () => {
    setStep("phone");
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
      setError(t("errorCodeRequired"));
      return;
    }

    const result = await loginWithPhone(normalizedPhone, trimmedCode);
    if (!result.success) {
      const key =
        result.error === "invalid_code"
          ? "errorInvalidCode"
          : result.error === "throttled"
            ? "errorThrottled"
            : "errorPhoneLoginUnavailable";
      setError(t(key));
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

  if (step === "phone") {
    return (
      <form className="space-y-4" onSubmit={handlePhoneSubmit}>
        {errorBanner}

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

        {useEmailInsteadSlot && <div className="text-center">{useEmailInsteadSlot}</div>}
      </form>
    );
  }

  return (
    <form className="space-y-4" onSubmit={handleCodeSubmit}>
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
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          pattern="[0-9]*"
          required
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          disabled={isLoading}
          placeholder={t("codePlaceholder")}
          className="folio-input mt-1"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="btn btn-primary w-full"
        style={{ padding: "12px 16px", fontSize: 14 }}
      >
        {isLoading ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            {t("verifyingCode")}
          </>
        ) : (
          <>
            {t("verifyCode")} <ArrowRight size={14} />
          </>
        )}
      </button>

      <div className="flex items-center justify-between text-[13px]">
        <button
          type="button"
          onClick={handleChangeNumber}
          disabled={isLoading}
          className="underline"
          style={{ color: "var(--muted)" }}
        >
          {t("changeNumber")}
        </button>
        <button
          type="button"
          onClick={handleResend}
          disabled={isLoading || isSendingCode || cooldown > 0}
          className="underline"
          style={{ color: "var(--muted)" }}
        >
          {cooldown > 0 ? t("resendIn", { seconds: cooldown }) : t("resendCode")}
        </button>
      </div>
    </form>
  );
}
