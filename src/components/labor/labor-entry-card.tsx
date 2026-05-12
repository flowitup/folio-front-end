"use client";

/**
 * LaborEntryCard — single attendance row, extracted from
 * `attendance-table.tsx` for reuse in the upcoming
 * `<AttendanceDayDetailSheet>` (Phase 2c) that surfaces a clicked
 * day's entries inside the calendar drawer.
 *
 * Pure presentational component. No state. Delete is delegated to the
 * caller via onDelete; pass `canManage=false` to hide the trash button.
 *
 * Plan: 260512-2341-labor-calendar-and-bulk-log → phase-02 (2a).
 */

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { LaborEntry, ShiftType } from "@/types/labor";
import { formatEUR } from "@/lib/api/labor";

interface LaborEntryCardProps {
  entry: LaborEntry;
  canManage: boolean;
  onDelete: (entry: LaborEntry) => void;
}

export function LaborEntryCard({
  entry,
  canManage,
  onDelete,
}: LaborEntryCardProps) {
  const t = useTranslations("labor");

  const shiftLabel: Record<ShiftType, string> = {
    full: t("shiftFull"),
    half: t("shiftHalf"),
    overtime: t("shiftOvertime"),
  };

  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{entry.worker_name}</span>

            {/* Shift chip — only when shift_type is set */}
            {entry.shift_type !== null ? (
              <Badge variant="secondary" className="text-xs">
                {shiftLabel[entry.shift_type] ?? entry.shift_type}
              </Badge>
            ) : entry.supplement_hours > 0 ? (
              // Standalone supplement row — no shift, show italic label
              // instead of a chip so the row reads "(supplement only)".
              <span className="text-muted-foreground text-xs italic">
                {t("supplement.standaloneShiftLabel") || "(supplement only)"}
              </span>
            ) : null}

            {/* Supplement hours badge — shown whenever > 0 */}
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

          <div className="flex items-center gap-2 text-sm">
            <span className="text-primary font-medium">
              {formatEUR(entry.effective_cost)}
            </span>
            {entry.amount_override !== null && (
              <span className="text-muted-foreground text-xs">
                ({t("override")})
              </span>
            )}
            {entry.note && (
              <span className="text-muted-foreground">— {entry.note}</span>
            )}
          </div>
        </div>

        {canManage && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(entry)}
            aria-label={t("delete")}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
