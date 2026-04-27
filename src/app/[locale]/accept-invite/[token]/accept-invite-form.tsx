"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Loader2, AlertCircle, ArrowRight, Info } from "lucide-react";
import { acceptInviteAction } from "@/lib/auth/actions";
import type { VerifyInviteResponse } from "@/lib/auth/types";

interface AcceptInviteFormProps {
  token: string;
  locale: string;
  verified: VerifyInviteResponse;
}

export function AcceptInviteForm({ token, locale, verified }: AcceptInviteFormProps) {
  const t = useTranslations("acceptInvite");

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side validation
    if (!name.trim() || name.trim().length < 1 || name.trim().length > 100) {
      setError(t("errors.generic"));
      return;
    }
    if (password.length < 8 || password.length > 128) {
      setError(t("passwordHint"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("passwordMismatch"));
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await acceptInviteAction(token, name.trim(), password);
      if (!result.success) {
        setError(result.error ?? t("errors.generic"));
        return;
      }
      // Cookies are set server-side; full navigation triggers fresh SSR with auth context
      window.location.href = `/${locale}/dashboard`;
    } catch {
      setError(t("errors.generic"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen grid-cols-12">
      {/* Left — form column */}
      <div
        className="col-span-12 flex flex-col p-10 lg:col-span-5"
        style={{ background: "var(--paper)" }}
      >
        <div className="m-auto w-full max-w-[380px]">
          <h1 className="font-display text-[32px] font-medium leading-[1.1] tracking-tight">
            {t("title")}
          </h1>
          <p className="mt-2 text-[14px]" style={{ color: "var(--muted)" }}>
            {t("subtitle")}
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
                projectName: verified.project_name,
                roleName: verified.role_name,
              })}
            </span>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
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

            {/* Email — read-only */}
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

            {/* Full name */}
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
                disabled={isSubmitting}
                className="folio-input mt-1"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="label-cap">
                {t("passwordLabel")}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                className="folio-input mt-1"
              />
              <p className="mt-1 text-[11px]" style={{ color: "var(--muted)" }}>
                {t("passwordHint")}
              </p>
            </div>

            {/* Confirm password */}
            <div>
              <label htmlFor="confirmPassword" className="label-cap">
                {t("confirmLabel")}
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isSubmitting}
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
          </form>

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
