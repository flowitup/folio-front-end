"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { requestOtpAction, type RequestOtpError } from "@/lib/auth/otp-actions";
import { normalizeFrenchPhone } from "@/lib/auth/phone-number";
import { CODE_LENGTH } from "./CodeBoxes";

// Matches the backend's resend-throttle window (`resend_after_seconds`) so the
// client-side countdown never lets the user ask for a code before the server
// would accept another request anyway.
const RESEND_COOLDOWN_SECONDS = 60;

function requestErrorKey(error: RequestOtpError): string {
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

export interface PhoneLoginFlow {
  step: "phone" | "code";
  /** What the user typed, national form — the field's value. */
  nationalNumber: string;
  setNationalNumber: (value: string) => void;
  /** E.164 the code was sent to; empty until a code has gone out. */
  sentTo: string;
  code: string;
  setCode: (value: string) => void;
  /** `auth` message key of the current error, or null. */
  errorKey: string | null;
  isSendingCode: boolean;
  isVerifying: boolean;
  /** Code accepted — held while the redirect into the app takes over. */
  verified: boolean;
  /** Seconds left before "Resend" is allowed again. */
  cooldown: number;
  /** How long the code the backend just sent stays valid, in whole minutes. */
  expiresInMinutes: number;
  canSend: boolean;
  canVerify: boolean;
  sendCode: () => Promise<void>;
  verify: (explicitCode?: string) => Promise<void>;
  changeNumber: () => void;
}

/**
 * The whole phone + SMS-code sign-in, owned in one place because the screen
 * shows it twice: the copy column reacts to the step and the number, while the
 * paper card holds the fields. Requesting and verifying the code stay in the
 * server actions — this only sequences them.
 */
export function usePhoneLoginFlow(): PhoneLoginFlow {
  const { loginWithPhone, isLoading } = useAuth();

  const [step, setStep] = useState<"phone" | "code">("phone");
  const [nationalNumber, setNationalNumber] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [code, setCode] = useState("");
  const [errorKey, setErrorKey] = useState<string | null>(null);
  // requestOtpAction is a plain server action, not wired into AuthContext, so
  // it needs its own pending flag distinct from useAuth().isLoading (which
  // only tracks login / loginWithPhone).
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [verified, setVerified] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  // The code the backend has already rejected. Re-sending it would spend another
  // of the five attempts for nothing, so the form waits for a changed digit —
  // state, not a ref, because the submit button's own state depends on it.
  const [lastSubmitted, setLastSubmitted] = useState<string | null>(null);
  // The backend decides the code's lifetime (OTP_TTL_SECONDS) and reports it on
  // every request, so the card quotes what was actually sent rather than a
  // number that silently drifts from the server's.
  const [expiresInMinutes, setExpiresInMinutes] = useState(5);

  // Countdown ticker for the "Resend in {n}s" label.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const phone = normalizeFrenchPhone(nationalNumber);
  // The backend throttles per number, so the countdown only gates asking again
  // for the SAME number: edit the number and "Send code" is live immediately.
  const canSend = phone !== null && !isSendingCode && (cooldown === 0 || phone !== sentTo);
  const canVerify =
    new RegExp(`^\\d{${CODE_LENGTH}}$`).test(code) &&
    !isLoading &&
    !verified &&
    code !== lastSubmitted;

  const sendCode = useCallback(async () => {
    const target = normalizeFrenchPhone(nationalNumber);
    if (!target) {
      setErrorKey("errorInvalidPhone");
      return;
    }
    setErrorKey(null);
    setIsSendingCode(true);
    const result = await requestOtpAction(target);
    setIsSendingCode(false);
    if (!result.success) {
      setErrorKey(requestErrorKey(result.error));
      return;
    }
    // A new code invalidates whatever is still in the boxes.
    setCode("");
    setLastSubmitted(null);
    setSentTo(target);
    setExpiresInMinutes(Math.max(1, Math.round(result.expiresIn / 60)));
    setCooldown(RESEND_COOLDOWN_SECONDS);
    setStep("code");
  }, [nationalNumber]);

  const verify = useCallback(
    async (explicitCode?: string) => {
      // The backend counts a wrong code against a 5-attempt limit, so never let
      // an auto-submit and a manual submit of the same code both go out.
      if (isLoading || verified) return;
      // Auto-submit passes the code it just completed: reading it from state
      // here would still see the value from before that keystroke.
      const submitted = (explicitCode ?? code).trim();
      if (!new RegExp(`^\\d{${CODE_LENGTH}}$`).test(submitted)) {
        setErrorKey("errorCodeRequired");
        return;
      }
      if (submitted === lastSubmitted) return;
      setLastSubmitted(submitted);
      setErrorKey(null);
      const result = await loginWithPhone(sentTo, submitted);
      if (result.success) {
        setVerified(true);
        return;
      }
      // Keep the digits: the user needs to see what was rejected and retype
      // over it, not start from an empty row.
      setErrorKey(
        result.error === "invalid_code"
          ? "errorInvalidCode"
          : result.error === "throttled"
            ? "errorThrottled"
            : "errorPhoneLoginUnavailable"
      );
    },
    [code, isLoading, lastSubmitted, loginWithPhone, sentTo, verified]
  );

  const changeNumber = useCallback(() => {
    // The countdown keeps running: it belongs to the number a code just went
    // to, and coming back to edit it does not make the server accept a resend.
    setStep("phone");
    setCode("");
    setLastSubmitted(null);
    setErrorKey(null);
    setVerified(false);
  }, []);

  return {
    step,
    nationalNumber,
    setNationalNumber,
    sentTo,
    code,
    setCode,
    errorKey,
    isSendingCode,
    isVerifying: isLoading,
    verified,
    cooldown,
    expiresInMinutes,
    canSend,
    canVerify,
    sendCode,
    verify,
    changeNumber,
  };
}
