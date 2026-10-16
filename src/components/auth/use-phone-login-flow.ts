"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { useAuth } from "@/context/AuthContext";
import { requestOtpAction, type RequestOtpError } from "@/lib/auth/otp-actions";
import { normalizeFrenchPhone } from "@/lib/auth/phone-number";
import { CODE_LENGTH } from "./CodeBoxes";

// Matches the backend's resend-throttle window (`resend_after_seconds`) so the
// client-side countdown never lets the user ask for a code before the server
// would accept another request anyway.
const RESEND_COOLDOWN_SECONDS = 60;

// The backend refuses a code after this many wrong tries (`max_attempts`),
// even the right one: past it only a new code helps.
export const MAX_CODE_ATTEMPTS = 5;

// Where the code step survives a language switch or a reload: the locale is a
// path segment, so switching it remounts the page and would drop the number.
const STORAGE_KEY = "folio.login.code-step";

interface SavedCodeStep {
  nationalNumber: string;
  sentTo: string;
  expiresAt: number | null;
  cooldownUntil: number;
  failedAttempts: number;
}

function readSavedCodeStep(): SavedCodeStep | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<SavedCodeStep>;
    if (typeof saved.sentTo !== "string" || !saved.sentTo) return null;
    const expiresAt = typeof saved.expiresAt === "number" ? saved.expiresAt : null;
    const cooldownUntil = typeof saved.cooldownUntil === "number" ? saved.cooldownUntil : 0;
    // A code that has run out is worth nothing to come back to.
    if (Math.max(expiresAt ?? 0, cooldownUntil) <= Date.now()) return null;
    return {
      nationalNumber: typeof saved.nationalNumber === "string" ? saved.nationalNumber : "",
      sentTo: saved.sentTo,
      expiresAt,
      cooldownUntil,
      failedAttempts: typeof saved.failedAttempts === "number" ? saved.failedAttempts : 0,
    };
  } catch {
    return null;
  }
}

function writeSavedCodeStep(saved: SavedCodeStep | null): void {
  try {
    if (saved) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked (private mode): the flow still works, it just does not survive a reload.
  }
}

function requestErrorKey(error: RequestOtpError): string {
  switch (error) {
    case "invalid_phone":
      return "errorInvalidPhone";
    case "throttled":
      return "errorThrottled";
    case "hourly_limit":
      return "errorHourlyLimit";
    case "network_limit":
      return "errorNetworkLimit";
    case "sms_busy":
      return "errorSmsBusy";
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
  /** Values the error message needs (the hourly cap's `minutes`). */
  errorValues: { minutes: number } | undefined;
  isSendingCode: boolean;
  isVerifying: boolean;
  /** Code accepted — held while the redirect into the app takes over. */
  verified: boolean;
  /** Seconds left before "Resend" is allowed again. */
  cooldown: number;
  /** Whole minutes (rounded up) the code just sent stays valid from now. */
  expiresInMinutes: number;
  /** The code's lifetime has run out: it can only be refused. */
  codeExpired: boolean;
  /** Too many wrong tries: the backend now refuses this code, a new one is needed. */
  codeLocked: boolean;
  canSend: boolean;
  /** Back on the phone step with the number a live code went to, inside the
   * resend window: Send returns to that code instead of asking for another. */
  waitingOnSameNumber: boolean;
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
  const locale = useLocale();

  const [step, setStep] = useState<"phone" | "code">("phone");
  const [nationalNumber, setNationalNumberState] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [code, setCode] = useState("");
  const [errorKey, setErrorKey] = useState<string | null>(null);
  // Minutes left on the number's hourly code cap, shown in its message.
  const [retryAfterMinutes, setRetryAfterMinutes] = useState(0);
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
  // every request. Kept as a deadline and ticked down, so the card never keeps
  // saying "Expires in 5 minutes" about a code that has already expired.
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // Wrong codes the backend refused for the code now in use.
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [restored, setRestored] = useState(false);

  // Back on the code step after a language switch or a reload. Read after
  // mount, so the server render and the first client render agree.
  useEffect(() => {
    const saved = readSavedCodeStep();
    if (saved) {
      const at = Date.now();
      setNationalNumberState(saved.nationalNumber);
      setSentTo(saved.sentTo);
      setExpiresAt(saved.expiresAt);
      setNow(at);
      setCooldown(Math.max(0, Math.ceil((saved.cooldownUntil - at) / 1000)));
      setFailedAttempts(saved.failedAttempts);
      if (saved.failedAttempts >= MAX_CODE_ATTEMPTS) setErrorKey("errorCodeLocked");
      setStep("code");
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (step !== "code" || expiresAt === null) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [step, expiresAt]);

  const remainingSeconds = expiresAt === null ? 300 : Math.max(0, Math.ceil((expiresAt - now) / 1000));
  const expiresInMinutes = Math.max(1, Math.ceil(remainingSeconds / 60));
  const codeExpired = expiresAt !== null && remainingSeconds <= 0;
  const codeLocked = failedAttempts >= MAX_CODE_ATTEMPTS;

  // Keep the code step saved while it is on screen; leaving it forgets it.
  useEffect(() => {
    if (!restored) return;
    if (step !== "code" || verified || !sentTo) {
      writeSavedCodeStep(null);
      return;
    }
    writeSavedCodeStep({
      nationalNumber,
      sentTo,
      expiresAt,
      cooldownUntil: Date.now() + cooldown * 1000,
      failedAttempts,
    });
    // `cooldown` is left out on purpose: its deadline is written when it starts
    // and recomputing it every tick would only drift it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restored, step, verified, nationalNumber, sentTo, expiresAt, failedAttempts, cooldown === 0]);

  // Countdown ticker for the "Resend in {n}s" label.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Editing the number clears the "enter a French number" message it caused.
  const setNationalNumber = useCallback((value: string) => {
    setNationalNumberState(value);
    setErrorKey((prev) => (prev === "errorInvalidPhone" ? null : prev));
  }, []);

  const phone = normalizeFrenchPhone(nationalNumber);
  // The backend throttles per number, so the countdown only gates asking again
  // for the SAME number: edit the number and "Send code" is live immediately.
  // An invalid number keeps the button live: pressing it says what is wrong,
  // where a greyed-out button explained nothing.
  const waitingOnSameNumber = phone !== null && phone === sentTo && cooldown > 0;
  const canSend = nationalNumber.trim().length > 0 && !isSendingCode;
  const canVerify =
    new RegExp(`^\\d{${CODE_LENGTH}}$`).test(code) &&
    !isLoading &&
    !verified &&
    !codeExpired &&
    !codeLocked &&
    code !== lastSubmitted;

  const sendCode = useCallback(async () => {
    const target = normalizeFrenchPhone(nationalNumber);
    if (!target) {
      setErrorKey("errorInvalidPhone");
      return;
    }
    setErrorKey(null);
    if (target === sentTo && cooldown > 0) {
      // The server would refuse a resend this soon, and the code already sent
      // to this number is still good: go back to it.
      setStep("code");
      return;
    }
    setIsSendingCode(true);
    const result = await requestOtpAction(target, locale);
    setIsSendingCode(false);
    if (!result.success) {
      if (result.error === "throttled" && target !== sentTo) {
        // "A code was sent recently" to this number (a reload or another tab
        // lost track of it): that code is still good, so go and type it.
        setCode("");
        setLastSubmitted(null);
        setFailedAttempts(0);
        setSentTo(target);
        setExpiresAt(null);
        setCooldown(RESEND_COOLDOWN_SECONDS);
        setErrorKey("codeRecentlySent");
        setStep("code");
        return;
      }
      setRetryAfterMinutes(result.retryAfterMinutes ?? 0);
      setErrorKey(requestErrorKey(result.error));
      return;
    }
    // A new code invalidates whatever is still in the boxes.
    setCode("");
    setLastSubmitted(null);
    setFailedAttempts(0);
    setSentTo(target);
    const sentAt = Date.now();
    setNow(sentAt);
    setExpiresAt(sentAt + result.expiresIn * 1000);
    setCooldown(RESEND_COOLDOWN_SECONDS);
    setStep("code");
  }, [nationalNumber, sentTo, cooldown, locale]);

  const verify = useCallback(
    async (explicitCode?: string) => {
      // The backend counts a wrong code against a 5-attempt limit, so never let
      // an auto-submit and a manual submit of the same code both go out.
      // An expired code can only be refused and would spend an attempt.
      if (isLoading || verified || codeExpired || codeLocked) return;
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
      setRetryAfterMinutes(result.retryAfterMinutes ?? 0);
      if (result.error === "invalid_code") {
        const failed = failedAttempts + 1;
        setFailedAttempts(failed);
        // Past the limit the backend refuses even the right code: say so, and
        // let "Resend" through as soon as the server would take it.
        setErrorKey(failed >= MAX_CODE_ATTEMPTS ? "errorCodeLocked" : "errorInvalidCode");
        return;
      }
      setErrorKey(
        result.error === "throttled"
          ? "errorThrottled"
          : result.error === "network_limit"
            ? "errorNetworkLimit"
            : "errorPhoneLoginUnavailable"
      );
    },
    [code, codeExpired, codeLocked, failedAttempts, isLoading, lastSubmitted, loginWithPhone, sentTo, verified]
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
    errorValues:
      errorKey === "errorHourlyLimit" || errorKey === "errorNetworkLimit" || errorKey === "errorSmsBusy"
        ? { minutes: retryAfterMinutes }
        : undefined,
    isSendingCode,
    isVerifying: isLoading,
    verified,
    cooldown,
    expiresInMinutes,
    codeExpired,
    codeLocked,
    canSend,
    waitingOnSameNumber,
    canVerify,
    sendCode,
    verify,
    changeNumber,
  };
}
