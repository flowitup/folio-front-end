"use client";

/**
 * InviteMemberDialog — e-mail invitation for an OUTSIDER (someone not yet a
 * member of the project's company). Distinct from AssignMemberDialog
 * (insiders, searched from the company directory, no e-mail step).
 *
 * No role picker: every invite is sent as a plain member; the back-end
 * defaults the legacy role until Phase 4 drops it. An admin who wants the
 * new member to manage the project can promote them afterwards via
 * Settings › Company or re-assign them as manager once they've joined.
 */

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inviteMemberAction } from "./actions";

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

export function InviteMemberDialog({
  open,
  onOpenChange,
  projectId,
}: InviteMemberDialogProps) {
  const t = useTranslations("members");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);
    try {
      const result = await inviteMemberAction(projectId, email.trim());

      if (result.kind === "invitation_sent") {
        toast.success(t("toast.inviteSent", { email: email.trim() }));
      } else {
        // kind === "direct_added"
        toast.success(t("toast.directAdded", { email: email.trim() }));
      }

      onOpenChange(false);
      setEmail("");
      router.refresh();
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      if (status === 409) {
        toast.warning(t("toast.alreadyInvited", { email: email.trim() }));
      } else if (status === 429) {
        toast.error(t("toast.rateLimited"));
      } else {
        toast.error(t("toast.error"));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("invite.dialogTitle")}</DialogTitle>
          <DialogDescription>{t("invite.dialogDescription")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="invite-email" aria-required="true">
              {t("invite.emailLabel")}
            </Label>
            <div className="relative">
              <Mail
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                size={14}
                style={{ color: "var(--muted)" }}
              />
              <Input
                id="invite-email"
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="member@example.com"
                disabled={isSubmitting}
                className="pl-9"
              />
            </div>
            <p className="text-[11px]" style={{ color: "var(--muted)" }}>
              {t("invite.emailHint")}
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {t("invite.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !email.trim()}
              className="gap-1.5"
            >
              {isSubmitting && (
                <Loader2 aria-hidden="true" className="animate-spin" size={14} />
              )}
              {isSubmitting ? t("invite.submitting") : t("invite.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
