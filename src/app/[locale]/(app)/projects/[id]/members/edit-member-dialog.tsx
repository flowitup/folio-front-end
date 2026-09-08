"use client";

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
import { updateUserProfileAction } from "./actions";
import type { ProjectMember } from "@/lib/api/members";

interface EditMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  member: ProjectMember | null;
  /** Whether the caller may edit identity fields (email / display name). */
  canEditIdentity: boolean;
}

/**
 * Identity-only editor (email / display name). Project role is no longer
 * editable here — it is set at assignment time (AssignMemberDialog) and
 * changed by re-assigning; the members table dropped its Role column and
 * picker (roles-permissions-redesign: manager/member is a project
 * assignment, not a per-project role_id).
 */
export function EditMemberDialog({
  open,
  onOpenChange,
  projectId,
  member,
  canEditIdentity,
}: EditMemberDialogProps) {
  const t = useTranslations("members");
  const router = useRouter();
  const [displayName, setDisplayName] = useState(member?.display_name ?? "");
  const [email, setEmail] = useState(member?.email ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Re-sync local state whenever a different member is opened.
  const [lastUserId, setLastUserId] = useState(member?.user_id ?? null);
  if (member && member.user_id !== lastUserId) {
    setLastUserId(member.user_id);
    setDisplayName(member.display_name ?? "");
    setEmail(member.email ?? "");
  }

  if (!member) return null;

  const nameChanged = canEditIdentity && displayName.trim() !== (member.display_name ?? "");
  const emailChanged = canEditIdentity && email.trim().toLowerCase() !== member.email.toLowerCase();
  const hasChanges = nameChanged || emailChanged;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasChanges || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const payload: { email?: string; display_name?: string | null } = {};
      if (emailChanged) payload.email = email.trim();
      if (nameChanged) payload.display_name = displayName.trim() || null;
      await updateUserProfileAction(projectId, member.user_id, payload);
      toast.success(t("edit.toast.saved"));
      onOpenChange(false);
      router.refresh();
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      if (status === 409) {
        toast.error(t("edit.toast.emailTaken"));
      } else if (status === 403) {
        toast.error(t("edit.toast.forbidden"));
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
          <DialogTitle>{t("edit.dialogTitle")}</DialogTitle>
          <DialogDescription>{t("edit.dialogDescription")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {canEditIdentity && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="edit-name">{t("edit.nameLabel")}</Label>
                <Input
                  id="edit-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={member.email.split("@")[0]}
                  disabled={isSubmitting}
                  maxLength={255}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-email">{t("edit.emailLabel")}</Label>
                <div className="relative">
                  <Mail
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                    size={14}
                    style={{ color: "var(--muted)" }}
                  />
                  <Input
                    id="edit-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isSubmitting}
                    className="pl-9"
                  />
                </div>
                <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                  {t("edit.emailHint")}
                </p>
              </div>
            </>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {t("invite.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting || !hasChanges} className="gap-1.5">
              {isSubmitting && (
                <Loader2 aria-hidden="true" className="animate-spin" size={14} />
              )}
              {isSubmitting ? t("edit.submitting") : t("edit.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
