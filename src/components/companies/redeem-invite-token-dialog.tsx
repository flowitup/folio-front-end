"use client";

/**
 * RedeemInviteTokenDialog — lets a user paste an invite token to attach a company.
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
import { redeemInviteTokenAction } from "@/app/[locale]/(app)/settings/_actions/companies-actions";
import type { MyCompany } from "@/types/companies";

interface RedeemInviteTokenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful redemption with the newly attached company. */
  onAttached: (company: MyCompany) => void;
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
      const result = await redeemInviteTokenAction(trimmed);

      if (!result.ok) {
        // Surface ALL failures with the single uniform message per spec.
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
      onAttached(result.data);
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
