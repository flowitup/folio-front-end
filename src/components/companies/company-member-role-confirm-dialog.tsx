"use client";

/**
 * CompanyMemberRoleConfirmDialog — confirms a change to or from Admin in the
 * members table. Promoting hands over full control of the company; demoting
 * takes away access to every project the person reached as an admin, and the
 * back end also drops every project assignment they held in this company
 * (SetMemberRoleUseCase), so the dialog lists those projects first.
 */

import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
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
import type { CompanyRole } from "@/types/companies";

export interface CompanyMemberRoleChange {
  userId: string;
  memberName: string;
  from: CompanyRole;
  to: CompanyRole;
  /** Labels of the projects the person is assigned to in this company. */
  assignedProjects: string[];
}

/** Changes to or from Admin need a confirmation; manager ⇄ member apply at once. */
export function roleChangeNeedsConfirmation(from: CompanyRole, to: CompanyRole): boolean {
  return from !== to && (from === "admin" || to === "admin");
}

interface Props {
  change: CompanyMemberRoleChange | null;
  isSaving: boolean;
  roleLabel: (role: CompanyRole) => string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function CompanyMemberRoleConfirmDialog({ change, isSaving, roleLabel, onOpenChange, onConfirm }: Props) {
  const t = useTranslations("companySettings.members");
  const demotion = change?.from === "admin";

  return (
    <AlertDialog
      open={change !== null}
      onOpenChange={(open) => {
        if (!open && !isSaving) onOpenChange(open);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("roleConfirmTitle", { member: change?.memberName ?? "", role: change ? roleLabel(change.to) : "" })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {demotion
              ? t("roleConfirmDemote", { member: change?.memberName ?? "" })
              : t("roleConfirmPromote", { member: change?.memberName ?? "" })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {demotion && change && change.assignedProjects.length > 0 && (
          <div className="text-[13px]" data-testid="role-confirm-projects">
            <p style={{ color: "var(--muted)" }}>{t("roleConfirmProjectsLost")}</p>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
              {change.assignedProjects.map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSaving}>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              // Stay open until the request settles (errors keep it open).
              e.preventDefault();
              onConfirm();
            }}
            disabled={isSaving}
          >
            {isSaving && <Loader2 size={12} className="mr-1.5 animate-spin" />}
            {t("roleConfirmAction", { role: change ? roleLabel(change.to) : "" })}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
