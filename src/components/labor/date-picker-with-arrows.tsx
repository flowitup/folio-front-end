"use client";

/**
 * DatePickerWithArrows — date input flanked by prev/next-day arrows
 * (Phase 3c). Used in the LogDayDialog header so users can sweep
 * through consecutive days without re-opening the native picker.
 *
 * Pure controlled component; `value` is YYYY-MM-DD, parent owns state.
 *
 * Plan: 260512-2341-labor-calendar-and-bulk-log → phase-03 (3c).
 */

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DatePickerWithArrowsProps {
  value: string; // YYYY-MM-DD
  onChange: (next: string) => void;
  label?: string;
  /** Disable both arrows + input. */
  disabled?: boolean;
}

/**
 * Shift a YYYY-MM-DD string by ±N days without timezone drift.
 * Builds a UTC date so noon-local DST edges don't bump the day.
 */
export function shiftDate(date: string, deltaDays: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return date;
  const [, y, mo, d] = m.map(Number);
  const base = new Date(Date.UTC(y, mo - 1, d));
  base.setUTCDate(base.getUTCDate() + deltaDays);
  const yy = base.getUTCFullYear();
  const mm = String(base.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(base.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function DatePickerWithArrows({
  value,
  onChange,
  label,
  disabled = false,
}: DatePickerWithArrowsProps) {
  return (
    <div className="space-y-1">
      {label && <Label className="text-xs">{label}</Label>}
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => onChange(shiftDate(value, -1))}
          disabled={disabled}
          aria-label="Previous day"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => onChange(shiftDate(value, 1))}
          disabled={disabled}
          aria-label="Next day"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
