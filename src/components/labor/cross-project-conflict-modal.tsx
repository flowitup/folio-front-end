"use client";

/**
 * CrossProjectConflictModal — pre-save confirmation modal listing
 * every conflicting selection so the admin can decide whether to
 * proceed (Phase 4 — cook 4c).
 *
 * Pure presentational. Parent (LogDayDialog) builds the relevant
 * `groups` list from intersection of (checked tiles) ∩ (fetched
 * conflicts) and renders this modal on Save when non-empty.
 *
 * Plan: 260512-2341-labor-calendar-and-bulk-log → phase-04 (4c).
 */

import { useTranslations } from "next-intl";
import { AlertTriangle, Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ConflictGroup, ShiftType } from "@/types/labor";

interface CrossProjectConflictModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: ConflictGroup[];
  isSaving?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function CrossProjectConflictModal({
  open,
  onOpenChange,
  groups,
  isSaving = false,
  onCancel,
  onConfirm,
}: CrossProjectConflictModalProps) {
  const t = useTranslations("labor.conflict");
  const tLabor = useTranslations("labor");

  const shiftLabel: Record<ShiftType, string> = {
    full: tLabor("shiftFull"),
    half: tLabor("shiftHalf"),
    overtime: tLabor("shiftOvertime"),
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="text-[var(--warning)] h-5 w-5" />
            {t("modalTitle")}
          </DialogTitle>
          <DialogDescription>{t("modalBody")}</DialogDescription>
        </DialogHeader>

        <ul className="space-y-3 max-h-[50vh] overflow-y-auto">
          {groups.map((g) => (
            <li
              key={g.person_id}
              className="border-[var(--warning)]/40 bg-[var(--warning-tint)] rounded-md border p-3"
            >
              <div className="font-medium">{g.person_name}</div>
              <ul className="text-muted-foreground mt-1 space-y-0.5 text-sm">
                {g.entries.map((e) => (
                  <li key={e.project_id}>
                    {e.project_name}
                    {" — "}
                    {e.shift_type
                      ? shiftLabel[e.shift_type]
                      : tLabor("supplement.standaloneShiftLabel") ||
                        "(supplement only)"}
                    {e.supplement_hours > 0 && ` (+${e.supplement_hours}h)`}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSaving}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={isSaving}
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("continueAnyway")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
