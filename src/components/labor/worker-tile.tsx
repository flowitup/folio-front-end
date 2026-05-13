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

import { ChevronDown, ChevronUp, Clock } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { personColor, personInitials } from "@/lib/utils/person-color";
import type { ShiftType, Worker } from "@/types/labor";

interface WorkerTileProps {
  worker: Worker;
  checked: boolean;
  shiftType: ShiftType;
  /** Set on tiles whose worker is already logged for the target date. */
  locked?: boolean;
  /** Expanded reveals override / note / supplement controls — Phase 3d. */
  expanded?: boolean;
  onToggle: (next: boolean) => void;
  onShiftChange: (next: ShiftType) => void;
  onToggleExpanded?: () => void;
}

const SHIFT_LABELS: Record<ShiftType, string> = {
  full: "Full day",
  half: "Half day",
  overtime: "Overtime",
};

export function WorkerTile({
  worker,
  checked,
  shiftType,
  locked = false,
  expanded = false,
  onToggle,
  onShiftChange,
  onToggleExpanded,
}: WorkerTileProps) {
  const colorKey = worker.person_id ?? worker.id;
  const displayName = worker.person_name ?? worker.name;

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
            already logged
          </Badge>
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
              {(Object.keys(SHIFT_LABELS) as ShiftType[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {SHIFT_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {onToggleExpanded && (
            <button
              type="button"
              onClick={onToggleExpanded}
              className="text-muted-foreground hover:text-foreground inline-flex h-8 w-8 items-center justify-center rounded-md border"
              aria-label={expanded ? "Collapse extra options" : "Expand extra options"}
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
        <div className="text-muted-foreground flex items-center gap-1 text-xs">
          <Clock className="h-3 w-3" />
          <span>Override / note / supplement — wired in cook 3d</span>
        </div>
      )}
    </div>
  );
}
