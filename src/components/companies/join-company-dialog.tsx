"use client";

/**
 * JoinCompanyDialog — lets a user type a reusable 8-character company code
 * to attach a company.
 *
 * Success: toast + close dialog + calls onAttached() so parent can refresh list.
 * A wrong or revoked code (404), plus the local too-short/too-long validation
 * guard, surface a single uniform toast: "This company code is invalid or has
 * been revoked."
 *
 * Submit guard: useRef prevents double-submit even if the user clicks fast.
 */

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { joinCompanyByCodeAction } from "@/app/[locale]/(app)/settings/_actions/companies-actions";

interface JoinCompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful join; the parent reloads its list. */
  onAttached: () => void;
}

export function JoinCompanyDialog({
  open,
  onOpenChange,
  onAttached,
}: JoinCompanyDialogProps) {
  const t = useTranslations("companies");

  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  function handleOpenChange(next: boolean) {
    if (isSubmitting) return;
    if (!next) setCode("");
    onOpenChange(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed || submittingRef.current) return;

    submittingRef.current = true;
    setIsSubmitting(true);

    try {
      const result = await joinCompanyByCodeAction(trimmed);

      if (!result.ok) {
        // Error surfacing policy (chosen behavior, reviewed 2026-05-07,
        // preserved when the dialog dropped token-based redemption):
        // "not_found" (unknown/revoked code) and "validation" (local
        // length guard) both represent "the code you typed doesn't work"
        // and map to a single uniform user-facing message — exposing the
        // distinction adds no value. Other codes (company_already_attached,
        // rate_limited, unauthorized, generic) surface their distinct
        // messages: each is actionable on its own (join elsewhere, wait and
        // retry, log in again, generic fallback).
        const isCodeInvalid =
          result.error.code === "not_found" || result.error.code === "validation";

        toast.error(
          isCodeInvalid ? t("invite.tokenInvalidError") : result.error.message
        );
        return;
      }

      toast.success(t("invite.successToast"));
      setCode("");
      onOpenChange(false);
      onAttached();
    } catch {
      toast.error(t("invite.tokenInvalidError"));
    } finally {
      setIsSubmitting(false);
      submittingRef.current = false;
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("invite.dialogTitle")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="company-code">{t("invite.inputLabel")}</Label>
            <Input
              id="company-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t("invite.inputPlaceholder")}
              disabled={isSubmitting}
              autoFocus
              autoComplete="off"
            />
          </div>

          <DialogFooter className="pt-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isSubmitting}>
                {t("form.actions.cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!code.trim() || isSubmitting}>
              {isSubmitting && (
                <Loader2 size={14} className="mr-2 animate-spin" />
              )}
              {t("invite.attachCta")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
