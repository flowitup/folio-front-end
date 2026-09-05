"use client";

/**
 * CompanyJoinCodeCard — superadmin card (Invites tab) for the reusable company join code.
 *
 * The code is what members type on the mobile app ("Join a company") after signing up
 * with their phone number. Unlike invite tokens it is reusable and stays valid until
 * revoked or renewed, so it is shown in full and can be copied at any time.
 *
 * Actions: create (no code yet), renew (confirm — the old code stops working), revoke
 * (confirm). Submit guards: a ref prevents double-submit; the card owns the current
 * code locally so the page does not need to refetch the company.
 */

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, Copy, KeyRound, Loader2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  revokeJoinCodeAction,
  setJoinCodeAction,
} from "@/app/[locale]/(app)/settings/_actions/companies-actions";
import { formatJoinCode } from "@/lib/companies/join-code";

interface CompanyJoinCodeCardProps {
  companyId: string;
  /** Active code from the company payload (superadmin view), null when none. */
  initialCode: string | null;
}

export function CompanyJoinCodeCard({ companyId, initialCode }: CompanyJoinCodeCardProps) {
  const t = useTranslations("companies.admin.manage.joinCode");
  const tForm = useTranslations("companies.form.actions");

  const [code, setCode] = useState<string | null>(initialCode);
  const [isBusy, setIsBusy] = useState(false);
  const busyRef = useRef(false);
  const [copied, setCopied] = useState(false);
  const [renewConfirmOpen, setRenewConfirmOpen] = useState(false);
  const [revokeConfirmOpen, setRevokeConfirmOpen] = useState(false);

  async function handleSet(renew: boolean) {
    if (busyRef.current) return;
    busyRef.current = true;
    setIsBusy(true);
    try {
      const result = await setJoinCodeAction(companyId);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setCode(result.data);
      setCopied(false);
      toast.success(renew ? t("renewedToast") : t("createdToast"));
    } catch {
      toast.error(t("genericError"));
    } finally {
      setIsBusy(false);
      busyRef.current = false;
      setRenewConfirmOpen(false);
    }
  }

  async function handleRevoke() {
    if (busyRef.current) return;
    busyRef.current = true;
    setIsBusy(true);
    try {
      const result = await revokeJoinCodeAction(companyId);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setCode(null);
      setCopied(false);
      toast.success(t("revokedToast"));
    } catch {
      toast.error(t("genericError"));
    } finally {
      setIsBusy(false);
      busyRef.current = false;
      setRevokeConfirmOpen(false);
    }
  }

  async function handleCopy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(formatJoinCode(code));
      setCopied(true);
      toast.success(t("copiedToast"));
      setTimeout(() => setCopied(false), 2_000);
    } catch {
      toast.error(t("copyFailed"));
    }
  }

  return (
    <div className="folio-card p-5 space-y-4" data-testid="company-join-code-card">
      <div>
        <h4 className="font-medium text-[15px]">{t("title")}</h4>
        <p className="mt-1 text-[13px]" style={{ color: "var(--muted)" }}>
          {t("description")}
        </p>
      </div>

      {code ? (
        <div
          className="flex flex-wrap items-center gap-3 rounded-md border px-4 py-3"
          style={{ borderColor: "var(--line)", background: "var(--paper)" }}
        >
          <KeyRound size={16} style={{ color: "var(--muted)" }} aria-hidden />
          <code
            className="font-mono text-[20px] tracking-[0.2em]"
            data-testid="company-join-code-value"
          >
            {formatJoinCode(code)}
          </code>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleCopy()}
            disabled={isBusy}
            className="ml-auto"
          >
            {copied ? (
              <Check size={14} className="mr-1.5" />
            ) : (
              <Copy size={14} className="mr-1.5" />
            )}
            {copied ? t("copied") : t("copy")}
          </Button>
        </div>
      ) : (
        <p className="text-[13px]" style={{ color: "var(--muted)" }} data-testid="company-join-code-empty">
          {t("none")}
        </p>
      )}

      <div className="flex gap-2 flex-wrap">
        {code ? (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRenewConfirmOpen(true)}
              disabled={isBusy}
            >
              {isBusy ? (
                <Loader2 size={14} className="mr-2 animate-spin" />
              ) : (
                <RefreshCw size={14} className="mr-2" />
              )}
              {t("renew")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRevokeConfirmOpen(true)}
              disabled={isBusy}
              className="text-destructive border-destructive/30 hover:border-destructive/50 hover:text-destructive"
            >
              <X size={14} className="mr-2" />
              {t("revoke")}
            </Button>
          </>
        ) : (
          <Button type="button" onClick={() => void handleSet(false)} disabled={isBusy}>
            {isBusy ? (
              <Loader2 size={14} className="mr-2 animate-spin" />
            ) : (
              <KeyRound size={14} className="mr-2" />
            )}
            {t("create")}
          </Button>
        )}
      </div>

      <p className="text-[12px]" style={{ color: "var(--muted)" }}>
        {t("policyNote")}
      </p>

      {/* Renew confirm */}
      <AlertDialog open={renewConfirmOpen} onOpenChange={setRenewConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("renew")}</AlertDialogTitle>
            <AlertDialogDescription>{t("renewConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBusy}>{tForm("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleSet(true);
              }}
              disabled={isBusy}
            >
              {isBusy && <Loader2 size={12} className="mr-1.5 animate-spin" />}
              {t("renew")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke confirm */}
      <AlertDialog open={revokeConfirmOpen} onOpenChange={setRevokeConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("revoke")}</AlertDialogTitle>
            <AlertDialogDescription>{t("revokeConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBusy}>{tForm("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleRevoke();
              }}
              disabled={isBusy}
              className="bg-destructive hover:bg-destructive/90 focus:ring-destructive"
            >
              {isBusy && <Loader2 size={12} className="mr-1.5 animate-spin" />}
              {t("revoke")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
