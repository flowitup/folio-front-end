"use client";

import { type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { appInstallUrl } from "./app-install-url";
import { CodeBoxes, CODE_LENGTH } from "./CodeBoxes";
import { FrenchPhoneInput } from "./FrenchPhoneInput";
import type { PhoneLoginFlow } from "./use-phone-login-flow";

interface PhoneLoginFormProps {
  flow: PhoneLoginFlow;
}

/** Contents of the paper card: step badge, title, the step's field, the action. */
export function PhoneLoginForm({ flow }: PhoneLoginFormProps) {
  const t = useTranslations("auth");
  const isCodeStep = flow.step === "code";
  // Not an error: the code already sent to this number is the one to type.
  const isNotice = flow.errorKey === "codeRecentlySent";

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isCodeStep) {
      await flow.verify();
      return;
    }
    await flow.sendCode();
  };

  return (
    <form className="flex flex-col gap-[18px]" onSubmit={handleSubmit}>
      <div className="flex items-center gap-2">
        <span className="stamp accent">
          {t("stepBadge", { current: isCodeStep ? 2 : 1, total: 2 })}
        </span>
        {flow.verified && (
          <span className="stamp positive" data-testid="login-verified">
            {t("verified")}
          </span>
        )}
      </div>

      <h2 className="font-display text-[26px] font-medium leading-[1.1]" style={{ color: "var(--ink)" }}>
        {isCodeStep ? t("codeCardTitle") : t("phoneCardTitle")}
      </h2>

      {flow.errorKey && (
        <div
          data-testid="login-error"
          id="login-error"
          role={isNotice ? "status" : "alert"}
          className="flex items-start gap-2 rounded-[10px] p-3 text-[12.5px]"
          style={
            isNotice
              ? { background: "var(--paper-2)", color: "var(--ink)", border: "1px solid var(--border)" }
              : { background: "var(--negative-tint)", color: "#8a3924", border: "1px solid #e6c0ad" }
          }
        >
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
          <span>{t(flow.errorKey, flow.errorValues)}</span>
        </div>
      )}

      {isCodeStep && flow.codeRefused && (
        // Said to everyone whose code is refused, so it reveals nothing — but a number a
        // company added by phone has no account yet, and its owner learns where to make one.
        <p
          data-testid="login-no-account-hint"
          className="-mt-2 text-[13px] leading-[1.5]"
          style={{ color: "var(--ink)" }}
        >
          {t("codeRefusedNoAccount")} <InstallLink />
        </p>
      )}

      {isCodeStep ? <CodeStepFields flow={flow} /> : <PhoneStepFields flow={flow} />}

      <button
        type="submit"
        data-testid={isCodeStep ? "login-verify" : "login-send-code"}
        disabled={isCodeStep ? !flow.canVerify : !flow.canSend}
        className="btn btn-primary w-full"
        style={{ padding: "13px 16px", fontSize: 14 }}
      >
        {isCodeStep ? (
          flow.isVerifying ? (
            <>
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              {t("verifyingCode")}
            </>
          ) : (
            <>
              {t("verifyCode")} <ArrowRight size={14} aria-hidden="true" />
            </>
          )
        ) : flow.isSendingCode ? (
          <>
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            {t("sendingCode")}
          </>
        ) : (
          <>
            {t("sendCode")} <ArrowRight size={14} aria-hidden="true" />
          </>
        )}
      </button>

      {isCodeStep ? (
        <div className="flex items-center justify-between text-[12.5px]">
          <button
            type="button"
            data-testid="login-resend"
            onClick={() => void flow.sendCode()}
            disabled={flow.cooldown > 0 || flow.isSendingCode}
            className="underline disabled:no-underline"
            style={{ color: flow.cooldown > 0 ? "var(--muted-2)" : "var(--ink)" }}
          >
            {flow.cooldown > 0
              ? t("resendIn", { seconds: flow.cooldown })
              : t("resendCode")}
          </button>
          <span
            data-testid="login-code-expiry"
            style={{ color: flow.codeExpired ? "var(--negative)" : "var(--muted)" }}
          >
            {flow.codeExpired ? t("codeExpired") : t("codeExpires", { minutes: flow.expiresInMinutes })}
          </span>
        </div>
      ) : null}

      {isCodeStep ? (
        // Said to everyone, whether or not the number has an account, so it
        // gives nothing away — but someone who gets no SMS learns why.
        <p data-testid="login-code-help" className="text-[12px] leading-[1.5]" style={{ color: "var(--muted)" }}>
          {t("codeHelp")}
        </p>
      ) : (
        <>
          {flow.waitingOnSameNumber && (
            <div
              data-testid="login-code-already-sent"
              className="text-center text-[12px]"
              style={{ color: "var(--muted)" }}
            >
              {t("codeAlreadySent", { seconds: flow.cooldown })}
            </div>
          )}
          {/* Accounts are only made in the mobile app: a number nobody signed up with would
              otherwise wait here for an SMS that never comes. */}
          <p
            data-testid="login-no-account"
            className="rounded-[10px] p-3 text-[13.5px] leading-[1.5]"
            style={{ background: "var(--paper-2)", color: "var(--ink)", border: "1px solid var(--border)" }}
          >
            {t("noAccountUseMobileApp")} <InstallLink />
          </p>
        </>
      )}
    </form>
  );
}

/** The mobile app's install page, when the deployment has one. */
function InstallLink() {
  const t = useTranslations("auth");
  const url = appInstallUrl();
  if (!url) return null;
  return (
    <a
      data-testid="login-install-app"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium underline"
      style={{ color: "var(--ink)" }}
    >
      {t("installMobileApp")}
    </a>
  );
}

function PhoneStepFields({ flow }: { flow: PhoneLoginFlow }) {
  const t = useTranslations("auth");
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="phone" className="label-cap">
        {t("phoneLabel")}
      </label>
      <FrenchPhoneInput
        id="phone"
        autoFocus
        value={flow.nationalNumber}
        onChange={flow.setNationalNumber}
        invalid={flow.errorKey === "errorInvalidPhone"}
        describedBy={flow.errorKey ? "login-error" : undefined}
        disabled={flow.isSendingCode}
        placeholder={t("phonePlaceholder")}
      />
      <p className="mt-0.5 text-[12px]" style={{ color: "var(--muted)" }}>
        {t("phoneHint")}
      </p>
    </div>
  );
}

function CodeStepFields({ flow }: { flow: PhoneLoginFlow }) {
  const t = useTranslations("auth");
  return (
    <div className="flex flex-col gap-1">
      <span className="label-cap">{t("codeLabel")}</span>
      <CodeBoxes
        value={flow.code}
        onChange={flow.setCode}
        onComplete={(code) => void flow.verify(code)}
        state={
          flow.verified
            ? "verified"
            : flow.errorKey && flow.errorKey !== "codeRecentlySent"
              ? "error"
              : "idle"
        }
        disabled={flow.isVerifying || flow.verified}
        label={t("codeLabel")}
        positionLabel={(position) => t("codeDigit", { position, total: CODE_LENGTH })}
      />
    </div>
  );
}
