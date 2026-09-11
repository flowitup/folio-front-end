"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Loader2, AlertCircle, ArrowRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import type { LoginMode } from "@/lib/auth/types";
import { PhoneLoginForm } from "./PhoneLoginForm";
import type { PhoneLoginFlow } from "./use-phone-login-flow";

interface LoginFormProps {
  loginMode: LoginMode;
  flow: PhoneLoginFlow;
  /** Which form is on screen. Owned by LoginStage, whose copy column follows it. */
  view: "phone" | "email";
  onViewChange: (view: "phone" | "email") => void;
}

/** Picks the form this deployment offers, and in "both" mode the one in view. */
export function LoginForm({ loginMode, flow, view, onViewChange }: LoginFormProps) {
  if (loginMode === "phone") {
    return <PhoneLoginForm flow={flow} />;
  }

  if (loginMode === "both" && view === "phone") {
    return (
      <PhoneLoginForm
        flow={flow}
        useEmailInsteadSlot={<UseEmailInsteadToggle onClick={() => onViewChange("email")} />}
      />
    );
  }

  return (
    <EmailLoginForm
      usePhoneInsteadSlot={
        loginMode === "both" ? (
          <UsePhoneInsteadToggle onClick={() => onViewChange("phone")} />
        ) : undefined
      }
    />
  );
}

function UseEmailInsteadToggle({ onClick }: { onClick: () => void }) {
  const t = useTranslations("auth");
  return (
    <button
      type="button"
      data-testid="login-use-email"
      onClick={onClick}
      className="text-[13px] underline"
      style={{ color: "var(--muted)" }}
    >
      {t("useEmailInstead")}
    </button>
  );
}

function UsePhoneInsteadToggle({ onClick }: { onClick: () => void }) {
  const t = useTranslations("auth");
  return (
    <button
      type="button"
      data-testid="login-use-phone"
      onClick={onClick}
      className="text-[13px] underline"
      style={{ color: "var(--muted)" }}
    >
      {t("usePhoneInstead")}
    </button>
  );
}

interface EmailLoginFormProps {
  usePhoneInsteadSlot?: React.ReactNode;
}

function EmailLoginForm({ usePhoneInsteadSlot }: EmailLoginFormProps) {
  const { login, isLoading } = useAuth();
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError(t("errorRequired"));
      return;
    }

    const result = await login({ email, password });
    if (!result.success) {
      setError(result.error || t("errorInvalid"));
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <span className="stamp accent">{t("welcomeBack")}</span>
      <h2
        className="font-display text-[26px] font-medium leading-[1.1]"
        style={{ color: "var(--ink)" }}
      >
        {t("signIn")}
      </h2>

      {error && (
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
      )}

      <div>
        <label htmlFor="email" className="label-cap">
          {t("emailLabel")}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
          placeholder={t("emailPlaceholder")}
          className="folio-input mt-1"
        />
      </div>

      <div>
        <label htmlFor="password" className="label-cap">
          {t("passwordLabel")}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading}
          placeholder={t("passwordPlaceholder")}
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
            {t("signingIn")}
          </>
        ) : (
          <>
            {t("signIn")} <ArrowRight size={14} />
          </>
        )}
      </button>

      {usePhoneInsteadSlot && <div className="text-center">{usePhoneInsteadSlot}</div>}
    </form>
  );
}
