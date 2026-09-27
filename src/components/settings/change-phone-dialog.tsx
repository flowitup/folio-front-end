"use client";

/**
 * ChangePhoneDialog — Settings › Profile › "Change number".
 *
 * The phone is how the user signs in, so a new number is only saved once it is
 * proven: step 1 texts a code to the NEW number, step 2 takes that code and
 * swaps the number. The session stays valid. Same phone field and code boxes
 * as sign-in.
 */

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CodeBoxes, CODE_LENGTH } from "@/components/auth/CodeBoxes";
import { FrenchPhoneInput } from "@/components/auth/FrenchPhoneInput";
import { formatFrenchPhone, normalizeFrenchPhone } from "@/lib/auth/phone-number";
import type { User } from "@/lib/auth/types";
import {
  confirmPhoneChangeAction,
  requestPhoneChangeCodeAction,
  type ConfirmPhoneChangeError,
  type RequestPhoneChangeError,
} from "@/app/[locale]/(app)/settings/_actions/profile-actions";

// Matches the backend's resend throttle (resend_after_seconds), as on sign-in.
const RESEND_COOLDOWN_SECONDS = 60;
const CODE_PATTERN = new RegExp(`^\\d{${CODE_LENGTH}}$`);

/** Message key (`settings.changePhone.*`) for each server-action error. */
function errorKeyFor(error: RequestPhoneChangeError | ConfirmPhoneChangeError): string {
  switch (error) {
    case "invalid_phone":
      return "errorInvalidPhone";
    case "same_phone":
      return "errorSameNumber";
    case "phone_taken":
      return "errorPhoneTaken";
    case "throttled":
      return "errorThrottled";
    case "sms_failed":
      return "errorSmsFailed";
    case "invalid_code":
      return "errorInvalidCode";
    default:
      return "errorFailed";
  }
}

interface ChangePhoneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the updated user once the new number is saved. */
  onChanged: (user: User) => void;
}

export function ChangePhoneDialog({ open, onOpenChange, onChanged }: ChangePhoneDialogProps) {
  const t = useTranslations("settings.changePhone");
  const tAuth = useTranslations("auth");

  const [step, setStep] = useState<"phone" | "code">("phone");
  const [nationalNumber, setNationalNumber] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [code, setCode] = useState("");
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [expiresInMinutes, setExpiresInMinutes] = useState(5);
  // A rejected code is not re-sent unchanged: each try spends one of five attempts.
  const [lastSubmitted, setLastSubmitted] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((prev) => (prev > 0 ? prev - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const reset = () => {
    setStep("phone");
    setNationalNumber("");
    setSentTo("");
    setCode("");
    setErrorKey(null);
    setLastSubmitted(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const target = normalizeFrenchPhone(nationalNumber);
  const canSend = target !== null && !isSending && (cooldown === 0 || target !== sentTo);
  const canConfirm = CODE_PATTERN.test(code) && !isConfirming && code !== lastSubmitted;

  const sendCode = async (phone: string | null = target) => {
    if (!phone) {
      setErrorKey("errorInvalidPhone");
      return;
    }
    setErrorKey(null);
    setIsSending(true);
    const result = await requestPhoneChangeCodeAction(phone);
    setIsSending(false);
    if (!result.success) {
      setErrorKey(errorKeyFor(result.error));
      return;
    }
    setCode("");
    setLastSubmitted(null);
    setSentTo(phone);
    setExpiresInMinutes(Math.max(1, Math.round(result.expiresIn / 60)));
    setCooldown(RESEND_COOLDOWN_SECONDS);
    setStep("code");
  };

  const confirm = useCallback(
    async (explicitCode?: string) => {
      const submitted = (explicitCode ?? code).trim();
      if (isConfirming || !CODE_PATTERN.test(submitted) || submitted === lastSubmitted) return;
      setLastSubmitted(submitted);
      setErrorKey(null);
      setIsConfirming(true);
      const result = await confirmPhoneChangeAction(sentTo, submitted);
      setIsConfirming(false);
      if (!result.success) {
        setErrorKey(errorKeyFor(result.error));
        return;
      }
      reset();
      onOpenChange(false);
      onChanged(result.user);
    },
    [code, isConfirming, lastSubmitted, onChanged, onOpenChange, sentTo]
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (step === "code") await confirm();
    else await sendCode();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {step === "code"
              ? t("codeStep", { phone: formatFrenchPhone(sentTo) })
              : t("phoneStep")}
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          {errorKey && (
            <div
              data-testid="change-phone-error"
              role="alert"
              className="flex items-start gap-2 rounded-[10px] p-3 text-[12.5px]"
              style={{
                background: "var(--negative-tint)",
                color: "#8a3924",
                border: "1px solid #e6c0ad",
              }}
            >
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
              <span>{t(errorKey)}</span>
            </div>
          )}

          {step === "phone" ? (
            <div className="flex flex-col gap-1">
              <label htmlFor="change-phone-number" className="label-cap">
                {t("newNumber")}
              </label>
              <FrenchPhoneInput
                id="change-phone-number"
                testIdPrefix="change-phone"
                autoFocus
                value={nationalNumber}
                onChange={setNationalNumber}
                disabled={isSending}
                placeholder={tAuth("phonePlaceholder")}
              />
              <p className="mt-0.5 text-[12px]" style={{ color: "var(--muted)" }}>
                {tAuth("phoneHint")}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <span className="label-cap">{tAuth("codeLabel")}</span>
              <CodeBoxes
                value={code}
                onChange={setCode}
                onComplete={(value) => void confirm(value)}
                state={errorKey ? "error" : "idle"}
                disabled={isConfirming}
                label={tAuth("codeLabel")}
                positionLabel={(position) => tAuth("codeDigit", { position, total: CODE_LENGTH })}
                testIdPrefix="change-phone-code"
              />
              <div className="mt-2 flex items-center justify-between text-[12.5px]">
                <button
                  type="button"
                  data-testid="change-phone-resend"
                  onClick={() => void sendCode(sentTo)}
                  disabled={cooldown > 0 || isSending}
                  className="underline disabled:no-underline"
                  style={{ color: cooldown > 0 ? "var(--muted-2)" : "var(--ink)" }}
                >
                  {cooldown > 0 ? tAuth("resendIn", { seconds: cooldown }) : tAuth("resendCode")}
                </button>
                <span style={{ color: "var(--muted)" }}>
                  {tAuth("codeExpires", { minutes: expiresInMinutes })}
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            {step === "code" && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setStep("phone");
                  setCode("");
                  setLastSubmitted(null);
                  setErrorKey(null);
                }}
              >
                {t("otherNumber")}
              </button>
            )}
            <button
              type="submit"
              data-testid={step === "code" ? "change-phone-confirm" : "change-phone-send"}
              className="btn btn-primary"
              disabled={step === "code" ? !canConfirm : !canSend}
            >
              {(step === "code" ? isConfirming : isSending) && (
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              )}
              {step === "code"
                ? t(isConfirming ? "confirming" : "confirm")
                : tAuth(isSending ? "sendingCode" : "sendCode")}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
