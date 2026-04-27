"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { inviteMemberAction } from "./actions";
import type { Role } from "@/lib/api/roles";

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  roles: Role[];
}

export function InviteMemberDialog({
  open,
  onOpenChange,
  projectId,
  roles,
}: InviteMemberDialogProps) {
  const t = useTranslations("members");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !roleId) return;

    setIsSubmitting(true);
    try {
      const result = await inviteMemberAction(projectId, email.trim(), roleId);

      if (result.kind === "invitation_sent") {
        toast.success(t("toast.inviteSent", { email: email.trim() }));
      } else {
        // kind === "direct_added"
        toast.success(t("toast.directAdded", { email: email.trim() }));
      }

      onOpenChange(false);
      setEmail("");
      setRoleId("");
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
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">{t("invite.emailLabel")}</Label>
            <Input
              id="invite-email"
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="member@example.com"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-role">{t("invite.roleLabel")}</Label>
            <Select
              value={roleId}
              onValueChange={setRoleId}
              required
              disabled={isSubmitting}
            >
              <SelectTrigger id="invite-role">
                <SelectValue placeholder={t("invite.rolePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    <span className="font-medium">{role.name}</span>
                    {role.description && (
                      <span
                        className="ml-1.5 text-[11px]"
                        style={{ color: "var(--muted)" }}
                      >
                        — {role.description}
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {t("invite.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting || !email.trim() || !roleId}>
              {isSubmitting ? t("invite.submitting") : t("invite.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
