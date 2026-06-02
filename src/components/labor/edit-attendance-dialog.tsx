"use client";

/**
 * EditAttendanceDialog — edit an existing labor entry (Phase 3d).
 *
 * Stripped-down evolution of the former LogAttendanceDialog: the
 * worker and date pickers are gone (they're identity for the row
 * and can't change), leaving only the editable fields — shift type,
 * supplement hours, amount override, and note.
 *
 * Creation now flows through LogDayDialog (the bulk-log orchestrator
 * from cook 3c). This dialog only handles the "tap an existing row
 * → tweak it" path.
 *
 * Plan: 260512-2341-labor-calendar-and-bulk-log → phase-03 (3d).
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { capitalizeFirst } from "@/lib/utils/capitalize-first";
import { formatDate } from "@/lib/utils/formatters";
import type { LaborEntry, ShiftType, UpdateAttendancePayload } from "@/types/labor";

// Radix Select forbids value=""; sentinel maps to null shift_type.
const SHIFT_NONE = "__none__";

interface EditAttendanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: LaborEntry | null;
  onSave: (payload: UpdateAttendancePayload) => Promise<void>;
}

function formatEntryDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const [, y, mo, d] = m.map(Number);
  const date = new Date(y, mo - 1, d);
  // Localized weekday + canonical dd/mm/YYYY date.
  return `${capitalizeFirst(
    date.toLocaleDateString(undefined, { weekday: "long" }),
    undefined,
  )} ${formatDate(date)}`;
}

export function EditAttendanceDialog({
  open,
  onOpenChange,
  entry,
  onSave,
}: EditAttendanceDialogProps) {
  const t = useTranslations("labor");
  const [shiftType, setShiftType] = useState<ShiftType | null>(null);
  const [supplementHours, setSupplementHours] = useState(0);
  const [amountOverride, setAmountOverride] = useState("");
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hydrate form state from the entry every time the dialog opens.
  useEffect(() => {
    if (!open || !entry) return;
    setShiftType(entry.shift_type);
    setSupplementHours(entry.supplement_hours);
    setAmountOverride(
      entry.amount_override !== null ? String(entry.amount_override) : "",
    );
    setNote(entry.note ?? "");
    setError(null);
  }, [open, entry]);

  const isOutOfRange = supplementHours < 0 || supplementHours > 12;
  const isEmptyRow = shiftType === null && supplementHours === 0;
  const isOverrideWithoutShift =
    shiftType === null && amountOverride !== "" && amountOverride !== null;
  const canSubmit = !isEmptyRow && !isOutOfRange && !isOverrideWithoutShift;

  function handleShiftTypeChange(value: string) {
    setShiftType(value === SHIFT_NONE ? null : (value as ShiftType));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!entry) return;
    if (isOutOfRange) {
      setError(
        t("errors.supplementOutOfRange") ||
          "Supplement hours must be between 0 and 12",
      );
      return;
    }
    if (isEmptyRow || isOverrideWithoutShift) return;

    setIsSaving(true);
    try {
      await onSave({
        shift_type: shiftType,
        supplement_hours: supplementHours,
        amount_override: amountOverride ? parseFloat(amountOverride) : undefined,
        note: note.trim() || undefined,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("editEntry.title") || "Edit attendance"}</DialogTitle>
        </DialogHeader>

        {entry && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-muted/30 space-y-1 rounded-md p-3 text-sm">
              <div className="font-medium">{entry.worker_name}</div>
              <div className="text-muted-foreground text-xs">
                {formatEntryDate(entry.date)}
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("shiftType")}</Label>
              <Select
                value={shiftType ?? SHIFT_NONE}
                onValueChange={handleShiftTypeChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SHIFT_NONE}>
                    {t("shift.none") || "(none)"}
                  </SelectItem>
                  <SelectItem value="full">{t("shiftFull")}</SelectItem>
                  <SelectItem value="half">{t("shiftHalf")}</SelectItem>
                  <SelectItem value="overtime">{t("shiftOvertime")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplement-hours">
                {t("supplement.fieldLabel") || "Supplement hours"}
              </Label>
              <Input
                id="supplement-hours"
                type="number"
                min={0}
                max={12}
                step={1}
                inputMode="numeric"
                value={supplementHours}
                onChange={(e) =>
                  setSupplementHours(parseInt(e.target.value, 10) || 0)
                }
              />
              <p className="text-muted-foreground text-xs">
                {t("supplement.fieldHelp") ||
                  "Banked hours (not priced today, max 12)"}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="override">{t("override")} (EUR)</Label>
              <Input
                id="override"
                type="number"
                step="0.01"
                min="0"
                value={amountOverride}
                onChange={(e) => setAmountOverride(e.target.value)}
                placeholder="Leave empty for default rate"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="note">{t("note")}</Label>
              <Input
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("note")}
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={isSaving || !canSubmit}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("save")}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
