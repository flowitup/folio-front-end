"use client";

/**
 * LaborEntryCard — single attendance row. Flat row layout (no wrapping
 * Card) so callers can group rows inside a shared container with divider
 * lines. Used by attendance-table.tsx (list view) and
 * attendance-day-detail-sheet.tsx (calendar day drawer).
 *
 * Plan: 260512-2341-labor-calendar-and-bulk-log → phase-02 (2a).
 */

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatEUR } from "@/lib/api/labor";
import { personColor, personInitials } from "@/lib/utils/person-color";
import type { LaborEntry, ShiftType } from "@/types/labor";

function EntryAvatar({
  initials,
  color,
}: {
  initials: string;
  color: string;
}) {
  return (
    <span
      className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-full text-[11px] font-semibold text-white"
      style={{ backgroundColor: color }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

interface LaborEntryCardProps {
  entry: LaborEntry;
  canManage: boolean;
  onDelete: (entry: LaborEntry) => void;
  /** Optional — tapping the row triggers edit. */
  onEdit?: (entry: LaborEntry) => void;
}

export function LaborEntryCard({
  entry,
  canManage,
  onDelete,
  onEdit,
}: LaborEntryCardProps) {
  const t = useTranslations("labor");

  const shiftLabel: Record<ShiftType, string> = {
    full: t("shiftFull"),
    half: t("shiftHalf"),
    overtime: t("shiftOvertime"),
  };

  const colorKey = entry.worker_id ?? entry.worker_name;

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 transition",
        onEdit && "hover:bg-accent/40 cursor-pointer",
      )}
      onClick={onEdit ? () => onEdit(entry) : undefined}
      role={onEdit ? "button" : undefined}
      tabIndex={onEdit ? 0 : undefined}
      onKeyDown={
        onEdit
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onEdit(entry);
              }
            }
          : undefined
      }
    >
      {/* Avatar — colored initials matching calendar chips */}
      <EntryAvatar
        initials={personInitials(entry.worker_name)}
        color={personColor(colorKey)}
      />

      {/* Name + badges */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">{entry.worker_name}</span>

          {entry.shift_type !== null ? (
            <Badge variant="secondary" className="text-xs">
              {shiftLabel[entry.shift_type] ?? entry.shift_type}
            </Badge>
          ) : entry.supplement_hours > 0 ? (
            <span className="text-muted-foreground text-xs italic">
              {t("supplement.standaloneShiftLabel") || "(supplement only)"}
            </span>
          ) : null}

          {entry.supplement_hours > 0 && (
            <Badge
              variant="outline"
              className="text-xs"
              title={
                t("supplement.badgeTooltip") ||
                "Supplement hours (banked, not priced today)"
              }
            >
              +{entry.supplement_hours}h
            </Badge>
          )}
        </div>

        {entry.note && (
          <p className="text-muted-foreground mt-0.5 truncate text-xs">
            {entry.note}
          </p>
        )}
      </div>

      {/* Amount + override marker */}
      <div className="flex flex-none flex-col items-end">
        <span className="text-primary text-sm font-semibold tabular-nums">
          {formatEUR(entry.effective_cost)}
        </span>
        {entry.amount_override !== null && (
          <span className="text-muted-foreground text-[10px] uppercase tracking-wide">
            {t("override")}
          </span>
        )}
      </div>

      {canManage && (
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive flex-none"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(entry);
          }}
          aria-label={t("delete")}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
