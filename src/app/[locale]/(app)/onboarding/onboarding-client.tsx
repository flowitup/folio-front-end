"use client";

/**
 * OnboardingClient — the two entry paths for a company-less signed-in user
 * (D1/onboarding): create a new company (self-service, POST /companies —
 * caller becomes admin) or join an existing one by its join code (default
 * role member).
 *
 * On success this does a hard navigation (`window.location.assign`) rather
 * than `router.push` + `router.refresh()`: AuthContext seeds `user` once
 * from the root layout's server-side session at mount and does not
 * re-fetch on `router.refresh()`, so every company-aware client gate
 * (Sidebar "New project", Settings "Company" tab, ...) would stay stale
 * for this tab until a real reload. A full navigation is the simplest fix
 * that does not require restructuring AuthContext for this one flow.
 */

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Building2, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createCompanyAction,
  joinCompanyByCodeAction,
} from "@/app/[locale]/(app)/settings/_actions/companies-actions";

type Mode = "choose" | "create" | "join";

export function OnboardingClient() {
  const t = useTranslations("onboarding");
  const locale = useLocale();
  const [mode, setMode] = useState<Mode>("choose");

  // Create-company form state
  const [legalName, setLegalName] = useState("");
  const [address, setAddress] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Join-by-code form state
  const [code, setCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  function goToApp() {
    window.location.assign(`/${locale}/dashboard`);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!legalName.trim() || !address.trim() || isCreating) return;
    setIsCreating(true);
    try {
      const result = await createCompanyAction({
        legal_name: legalName.trim(),
        address: address.trim(),
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success(t("create.successToast"));
      goToApp();
    } finally {
      setIsCreating(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || isJoining) return;
    setIsJoining(true);
    try {
      const result = await joinCompanyByCodeAction(code.trim());
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success(t("join.successToast", { company: result.data.legal_name }));
      goToApp();
    } finally {
      setIsJoining(false);
    }
  }

  return (
    <div className="fade-up mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="font-display text-[28px] font-medium tracking-tight">{t("title")}</h1>
      <p className="mt-2 text-[14px]" style={{ color: "var(--muted)" }}>
        {t("subtitle")}
      </p>

      {mode === "choose" && (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setMode("create")}
            className="folio-card flex flex-col items-center gap-3 p-6 text-center transition-colors hover:border-[var(--ink)]"
          >
            <Building2 size={28} style={{ color: "var(--accent)" }} />
            <span className="font-display text-[16px] font-medium">{t("createCompanyCta")}</span>
            <span className="text-[12.5px]" style={{ color: "var(--muted)" }}>
              {t("createCompanyHint")}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMode("join")}
            className="folio-card flex flex-col items-center gap-3 p-6 text-center transition-colors hover:border-[var(--ink)]"
          >
            <KeyRound size={28} style={{ color: "var(--accent)" }} />
            <span className="font-display text-[16px] font-medium">{t("joinCompanyCta")}</span>
            <span className="text-[12.5px]" style={{ color: "var(--muted)" }}>
              {t("joinCompanyHint")}
            </span>
          </button>
        </div>
      )}

      {mode === "create" && (
        <form onSubmit={handleCreate} className="folio-card mt-8 space-y-4 p-6 text-left">
          <div className="space-y-1.5">
            <Label htmlFor="onboarding-legal-name" aria-required="true">
              {t("create.legalNameLabel")}
            </Label>
            <Input
              id="onboarding-legal-name"
              required
              autoFocus
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              disabled={isCreating}
              maxLength={255}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="onboarding-address" aria-required="true">
              {t("create.addressLabel")}
            </Label>
            <Textarea
              id="onboarding-address"
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={isCreating}
              rows={2}
              maxLength={2000}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setMode("choose")} disabled={isCreating}>
              {t("back")}
            </Button>
            <Button type="submit" disabled={isCreating || !legalName.trim() || !address.trim()} className="gap-1.5">
              {isCreating && <Loader2 aria-hidden="true" className="animate-spin" size={14} />}
              {t("create.submit")}
            </Button>
          </div>
        </form>
      )}

      {mode === "join" && (
        <form onSubmit={handleJoin} className="folio-card mt-8 space-y-4 p-6 text-left">
          <div className="space-y-1.5">
            <Label htmlFor="onboarding-join-code" aria-required="true">
              {t("join.codeLabel")}
            </Label>
            <Input
              id="onboarding-join-code"
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t("join.codePlaceholder")}
              disabled={isJoining}
              maxLength={32}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setMode("choose")} disabled={isJoining}>
              {t("back")}
            </Button>
            <Button type="submit" disabled={isJoining || !code.trim()} className="gap-1.5">
              {isJoining && <Loader2 aria-hidden="true" className="animate-spin" size={14} />}
              {t("join.submit")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
