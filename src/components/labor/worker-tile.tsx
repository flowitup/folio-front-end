"use client";

/**
 * WorkerTile — single selectable tile in the LogDayDialog tile grid
 * (Phase 3b).
 *
 * Visual states:
 *   - unchecked, unlocked: name + colored dot, neutral border
 *   - unchecked, locked (already logged this date): muted, "already
 *     logged" badge, click no-op
 *   - checked: filled background + primary border + reveals shift
 *     dropdown
 *
 * Uses the same personColor + personInitials helpers as the calendar
 * cell chips, so a given worker's color is identical across the
 * dialog tile, the calendar chip, and the worker list — recognition
 * reinforced everywhere.
 *
 * Pure presentational. Parent (LogDayDialog, cook 3c) owns the
 * checked/shift_type/expanded state and supplies callbacks.
 *
 * Plan: 260512-2341-labor-calendar-and-bulk-log → phase-03 (3b).
 */

import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { personColor, personInitials } from "@/lib/utils/person-color";
import type { ConflictGroup, ShiftType, Worker } from "@/types/labor";

interface WorkerTileProps {
  worker: Worker;
  checked: boolean;
  shiftType: ShiftType;
  /** Set on tiles whose worker is already logged for the target date. */
  locked?: boolean;
  /** Expanded reveals override / note / supplement controls. */
  expanded?: boolean;
  /** Optional amount-override (EUR). Empty = use default rate. */
  amountOverride?: number;
  /** Optional supplement hours (0-12). */
  supplementHours?: number;
  /** Optional note. */
  note?: string;
  /** Phase 4: cross-project conflict group; renders ⚠ badge + tooltip. */
  conflict?: ConflictGroup;
  onToggle: (next: boolean) => void;
  onShiftChange: (next: ShiftType) => void;
  onToggleExpanded?: () => void;
  onAmountOverrideChange?: (next: number | undefined) => void;
  onSupplementHoursChange?: (next: number) => void;
  onNoteChange?: (next: string) => void;
}

export function WorkerTile({
  worker,
  checked,
  shiftType,
  locked = false,
  expanded = false,
  amountOverride,
  supplementHours,
  note,
  conflict,
  onToggle,
  onShiftChange,
  onToggleExpanded,
  onAmountOverrideChange,
  onSupplementHoursChange,
  onNoteChange,
}: WorkerTileProps) {
  const t = useTranslations("labor");
  const tTile = useTranslations("labor.logDayDialog.tile");
  const colorKey = worker.person_id ?? worker.id;
  const displayName = worker.person_name ?? worker.name;
  const shiftLabels: Record<ShiftType, string> = {
    full: t("shiftFull"),
    half: t("shiftHalf"),
    overtime: t("shiftOvertime"),
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-md border p-3 transition",
        checked
          ? "border-primary/60 bg-primary/5"
          : "border-border bg-background hover:border-primary/40",
        locked && "cursor-not-allowed opacity-60 hover:border-border",
      )}
    >
      <button
        type="button"
        onClick={() => !locked && onToggle(!checked)}
        disabled={locked}
        className={cn(
          "flex items-center justify-between gap-2 text-left",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
        aria-pressed={checked}
        aria-disabled={locked}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="text-[10px] inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-medium text-white"
            style={{ backgroundColor: personColor(colorKey) }}
            aria-hidden="true"
          >
            {personInitials(displayName)}
          </span>
          <span className="truncate text-sm font-medium">{displayName}</span>
        </div>
        {locked && (
          <Badge variant="outline" className="text-[10px] shrink-0">
            {tTile("alreadyLogged")}
          </Badge>
        )}
        {!locked && conflict && (
          <span
            className="text-amber-600 inline-flex items-center gap-1 text-[10px] shrink-0"
            title={conflict.entries
              .map((e) =>
                `${e.project_name}: ${e.shift_type ?? "(supplement)"}`,
              )
              .join(", ")}
            aria-label={tTile("conflictBadge")}
          >
            <AlertTriangle className="h-3 w-3" />
            <span className="font-medium uppercase">
              {tTile("conflictBadge")}
            </span>
          </span>
        )}
        {checked && !locked && (
          <span className="text-primary text-xs font-semibold" aria-hidden="true">
            ✓
          </span>
        )}
      </button>

      {checked && !locked && (
        <div className="flex items-center gap-2">
          <Select
            value={shiftType}
            onValueChange={(v) => onShiftChange(v as ShiftType)}
          >
            <SelectTrigger className="h-8 flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(shiftLabels) as ShiftType[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {shiftLabels[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {onToggleExpanded && (
            <button
              type="button"
              onClick={onToggleExpanded}
              className="text-muted-foreground hover:text-foreground inline-flex h-8 w-8 items-center justify-center rounded-md border"
              aria-label={expanded ? tTile("collapseOptions") : tTile("expandOptions")}
              aria-expanded={expanded}
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      )}

      {checked && expanded && !locked && (
        <div className="space-y-2 border-t pt-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px]" htmlFor={`override-${worker.id}`}>
                {tTile("overrideLabel")}
              </Label>
              <Input
                id={`override-${worker.id}`}
                type="number"
                step="0.01"
                min="0"
                value={amountOverride ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  onAmountOverrideChange?.(v === "" ? undefined : parseFloat(v));
                }}
                placeholder={tTile("overridePlaceholder")}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]" htmlFor={`supplement-${worker.id}`}>
                {tTile("supplementLabel")}
              </Label>
              <Input
                id={`supplement-${worker.id}`}
                type="number"
                min={0}
                max={12}
                step={1}
                inputMode="numeric"
                value={supplementHours ?? 0}
                onChange={(e) =>
                  onSupplementHoursChange?.(parseInt(e.target.value, 10) || 0)
                }
                className="h-8 text-xs"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]" htmlFor={`note-${worker.id}`}>
              {tTile("noteLabel")}
            </Label>
            <Input
              id={`note-${worker.id}`}
              value={note ?? ""}
              onChange={(e) => onNoteChange?.(e.target.value)}
              placeholder={tTile("notePlaceholder")}
              className="h-8 text-xs"
            />
          </div>
        </div>
      )}
    </div>
  );
}
