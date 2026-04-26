"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Loader2, AlertCircle, ArrowRight, Globe } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface LoginFormProps {
  callbackUrl?: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- reserved for future callbackUrl redirect
export function LoginForm({ callbackUrl = "/dashboard" }: LoginFormProps) {
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
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="label-cap">
            {t("passwordLabel")}
          </label>
          <a
            href="#"
            className="text-[12px]"
            style={{ color: "var(--accent-ink)" }}
            onClick={(e) => e.preventDefault()}
          >
            {t("forgot")}
          </a>
        </div>
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

      <button
        type="button"
        className="btn btn-ghost w-full"
        style={{ padding: "12px 16px", fontSize: 14 }}
        disabled={isLoading}
      >
        <Globe size={14} /> {t("continueWithGoogle")}
      </button>
    </form>
  );
}
