"use client";

/**
 * CompanyMemberBootConfirmDialog — confirms removing a member from ONE of
 * their companies (the Company column's uncheck). Mirrors the platform-ops
 * boot dialog (attached-users-table.tsx): booting is destructive — it drops
 * that company's project assignments, deactivates the directory profile and
 * rotates the join code — so it always goes through this confirm first.
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

export interface CompanyMemberBootTarget {
  userId: string;
  memberName: string;
  companyId: string;
  companyName: string;
}

interface Props {
  target: CompanyMemberBootTarget | null;
  isBooting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function CompanyMemberBootConfirmDialog({ target, isBooting, onOpenChange, onConfirm }: Props) {
  const t = useTranslations("companySettings.members");

  return (
    <AlertDialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open && !isBooting) onOpenChange(open);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("bootAction")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("bootConfirmDescription", {
              member: target?.memberName ?? "",
              company: target?.companyName ?? "",
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isBooting}>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isBooting}
            className="bg-destructive hover:bg-destructive/90 focus:ring-destructive"
          >
            {isBooting && <Loader2 size={12} className="mr-1.5 animate-spin" />}
            {t("bootAction")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
