"use client";

/**
 * RedeemInviteTokenDialog — lets a user paste an invite token (or type a reusable
 * 8-character company code) to attach a company.
 *
 * Success: toast + close dialog + calls onAttached() so parent can refresh list.
 * All failure cases (410, expired, wrong, already-redeemed) surface a single
 * uniform toast: "Invite token is invalid, expired, or already used."
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
import {
  joinCompanyByCodeAction,
  redeemInviteTokenAction,
} from "@/app/[locale]/(app)/settings/_actions/companies-actions";
import { looksLikeJoinCode } from "@/lib/companies/join-code";

interface RedeemInviteTokenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful redemption or join; the parent reloads its list. */
  onAttached: () => void;
}

export function RedeemInviteTokenDialog({
  open,
  onOpenChange,
  onAttached,
}: RedeemInviteTokenDialogProps) {
  const t = useTranslations("companies");

  const [token, setToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  function handleOpenChange(next: boolean) {
    if (isSubmitting) return;
    if (!next) setToken("");
    onOpenChange(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = token.trim();
    if (!trimmed || submittingRef.current) return;

    submittingRef.current = true;
    setIsSubmitting(true);

    try {
      // An 8-character value is a company join code; anything longer is an invite token.
      const result = looksLikeJoinCode(trimmed)
        ? await joinCompanyByCodeAction(trimmed)
        : await redeemInviteTokenAction(trimmed);

      if (!result.ok) {
        // Error surfacing policy (chosen behavior, reviewed 2026-05-07):
        // The 410-family codes (token_invalid, not_found, validation) all map to
        // a single uniform user-facing message per spec — these represent "bad token"
        // scenarios and exposing the distinction to the end-user adds no value.
        // Other codes (rate_limited, unauthorized, generic) surface their distinct
        // messages: "rate_limited" gives actionable wait-and-retry guidance;
        // "unauthorized" indicates a session expiry the user must resolve;
        // "generic" is already a generic fallback message safe to show.
        // This keeps UX clean for the common path while preserving actionability
        // for recoverable non-token errors.
        const isTokenError =
          result.error.code === "token_invalid" ||
          result.error.code === "not_found" ||
          result.error.code === "validation";

        toast.error(
          isTokenError
            ? t("invite.tokenInvalidError")
            : result.error.message
        );
        return;
      }

      toast.success(t("invite.successToast"));
      setToken("");
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
            <Label htmlFor="invite-token">{t("invite.inputLabel")}</Label>
            <Input
              id="invite-token"
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
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
            <Button type="submit" disabled={!token.trim() || isSubmitting}>
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
