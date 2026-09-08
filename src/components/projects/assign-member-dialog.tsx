"use client";

/**
 * AssignMemberDialog — assign an EXISTING company member (insider) to a
 * project, as manager or member. Distinct from InviteMemberDialog (outsider
 * e-mail invitation, no membership precondition): this searches the
 * company's linked-person directory and calls
 * PUT /projects/<id>/assignments/<userId> (assignments.ts).
 *
 * Only linked persons (a person with `linked_user_id`) are assignable — a
 * pending (phone-only) profile has no user account yet to assign rights to.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchCompanyDirectoryAction } from "@/app/[locale]/(app)/settings/_actions/company-settings-actions";
import { assignProjectMemberAction } from "@/app/[locale]/(app)/settings/_actions/company-settings-actions";
import type { CompanyDirectoryEntry } from "@/lib/api/companies-members";
import type { ProjectAssignmentRole } from "@/lib/api/assignments";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  companyId: string | null;
  /** Already-assigned user ids — excluded from the picker. */
  excludeUserIds: string[];
  /** Only a company admin may hand out the manager role — a manager assigning
      insiders may only assign "member" (mirrors assignments.ts / the backend's
      PUT /assignments authorization). */
  canAssignManager: boolean;
}

export function AssignMemberDialog({
  open,
  onOpenChange,
  projectId,
  companyId,
  excludeUserIds,
  canAssignManager,
}: Props) {
  const t = useTranslations("members");
  const router = useRouter();

  const [entries, setEntries] = useState<CompanyDirectoryEntry[]>([]);
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [role, setRole] = useState<ProjectAssignmentRole>("member");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !companyId) return;
    let cancelled = false;
    setIsLoadingDirectory(true);
    void fetchCompanyDirectoryAction(companyId).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setEntries(result.data);
      } else {
        // Surface the failure instead of silently rendering an empty
        // picker — a blank list otherwise reads as "no one to assign".
        toast.error(result.error.message);
      }
      setIsLoadingDirectory(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, companyId]);

  // Keep the Select's value in sync if canAssignManager flips false while
  // "manager" is selected (its SelectItem unmounts — see below).
  useEffect(() => {
    if (!canAssignManager && role === "manager") setRole("member");
  }, [canAssignManager, role]);

  // Only linked (has a user account), not-already-assigned persons are
  // assignable — a pending phone-only profile has no user_id to assign.
  const excludeSet = useMemo(() => new Set(excludeUserIds), [excludeUserIds]);
  const options: ComboboxOption[] = entries
    .filter((e) => e.linked_user_id && !excludeSet.has(e.linked_user_id))
    .map((e) => ({ value: e.linked_user_id as string, label: `${e.name} · ${e.phone}` }));

  function reset() {
    setSelectedUserId("");
    setRole("member");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUserId || isSubmitting) return;
    setIsSubmitting(true);
    // Defense-in-depth: the manager SelectItem is unmounted when
    // !canAssignManager (see below), but clamp here too in case `role`
    // state carried over from before a prop flip.
    const effectiveRole: ProjectAssignmentRole = canAssignManager ? role : "member";
    try {
      const result = await assignProjectMemberAction(projectId, selectedUserId, effectiveRole);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success(t("assign.successToast"));
      reset();
      onOpenChange(false);
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("assign.dialogTitle")}</DialogTitle>
          <DialogDescription>{t("assign.dialogDescription")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="label-cap" htmlFor="assign-member-search">
              {t("assign.personLabel")}
            </label>
            <div className="folio-input flex h-9 items-center px-3" id="assign-member-search">
              <Combobox
                value={selectedUserId}
                onChange={setSelectedUserId}
                options={options}
                allowFreeText={false}
                loading={isLoadingDirectory}
                placeholder={t("assign.personPlaceholder")}
                emptyText={t("assign.personEmpty")}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="label-cap" htmlFor="assign-member-role">
              {t("assign.roleLabel")}
            </label>
            <Select value={role} onValueChange={(v) => setRole(v as ProjectAssignmentRole)} disabled={isSubmitting}>
              <SelectTrigger id="assign-member-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">{t("assign.roleMember")}</SelectItem>
                {canAssignManager && (
                  <SelectItem value="manager">{t("assign.roleManager")}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              {t("invite.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting || !selectedUserId} className="gap-1.5">
              {isSubmitting && <Loader2 aria-hidden="true" className="animate-spin" size={14} />}
              {t("assign.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
