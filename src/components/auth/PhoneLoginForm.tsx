"use client";

import { type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { CodeBoxes, CODE_LENGTH } from "./CodeBoxes";
import type { PhoneLoginFlow } from "./use-phone-login-flow";

interface PhoneLoginFormProps {
  flow: PhoneLoginFlow;
  /** Rendered under the phone step — used in "both" mode to offer email sign-in. */
  useEmailInsteadSlot?: ReactNode;
}

/** Contents of the paper card: step badge, title, the step's field, the action. */
export function PhoneLoginForm({ flow, useEmailInsteadSlot }: PhoneLoginFormProps) {
  const t = useTranslations("auth");
  const isCodeStep = flow.step === "code";

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
          role="alert"
          className="flex items-start gap-2 rounded-[10px] p-3 text-[12.5px]"
          style={{
            background: "var(--negative-tint)",
            color: "#8a3924",
            border: "1px solid #e6c0ad",
          }}
        >
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
          <span>{t(flow.errorKey)}</span>
        </div>
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
          <span style={{ color: "var(--muted)" }}>
            {t("codeExpires", { minutes: flow.expiresInMinutes })}
          </span>
        </div>
      ) : (
        <div className="text-center text-[12px]" style={{ color: "var(--muted)" }}>
          {useEmailInsteadSlot ?? t("contactAdmin")}
        </div>
      )}
    </form>
  );
}

function PhoneStepFields({ flow }: { flow: PhoneLoginFlow }) {
  const t = useTranslations("auth");
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="phone" className="label-cap">
        {t("phoneLabel")}
      </label>
      {/* One control, two segments: sign-in codes only ever leave through a
          French gateway, so the dial code is stated rather than chosen. The
          border belongs to the wrapper, not to either segment. */}
      <div
        className="flex focus-within:border-[color:var(--ink)] focus-within:shadow-[var(--shadow-focus)]"
        style={{
          background: "var(--card-paper)",
          border: "1px solid var(--line-2)",
          borderRadius: 10,
        }}
      >
        <span
          data-testid="login-country"
          className="flex flex-shrink-0 items-center gap-1.5 rounded-l-[9px] pl-3 pr-2.5 text-[13px] font-medium"
          style={{
            background: "var(--paper-2)",
            borderRight: "1px solid var(--line-2)",
            color: "var(--ink-2)",
          }}
        >
          FR
          <span className="num text-[12.5px]" style={{ color: "var(--muted)" }}>
            +33
          </span>
        </span>
        <input
          id="phone"
          name="phone"
          data-testid="login-phone"
          type="tel"
          autoComplete="tel-national"
          inputMode="tel"
          required
          autoFocus
          value={flow.nationalNumber}
          onChange={(event) => flow.setNationalNumber(event.target.value)}
          disabled={flow.isSendingCode}
          placeholder={t("phonePlaceholder")}
          className="num min-w-0 flex-1 bg-transparent px-3 py-[11px] text-[14px] outline-none"
          style={{ color: "var(--ink)" }}
        />
      </div>
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
        state={flow.verified ? "verified" : flow.errorKey ? "error" : "idle"}
        disabled={flow.isVerifying || flow.verified}
        label={t("codeLabel")}
        positionLabel={(position) => t("codeDigit", { position, total: CODE_LENGTH })}
      />
    </div>
  );
}
