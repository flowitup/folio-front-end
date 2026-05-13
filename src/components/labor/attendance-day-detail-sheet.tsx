"use client";

/**
 * AttendanceDayDetailSheet — side panel listing one day's labor entries
 * (Phase 2c). Opens when the user clicks a CalendarCell.
 *
 * Built on Radix Dialog so we get focus trap, ESC-to-close, and ARIA
 * semantics for free. Custom CSS anchors it to the right edge on
 * desktop with a slide-in transition. On viewports narrower than the
 * `sm` Tailwind breakpoint (640 px) the sheet stretches to full
 * width so it behaves like a bottom-sheet on phones.
 *
 * Pure presentational — receives entries from parent and delegates
 * delete via onDelete. The eventual "log new attendance for this day"
 * CTA lands in Phase 2d when the new bulk-log dialog ships.
 *
 * Plan: 260512-2341-labor-calendar-and-bulk-log → phase-02 (2c).
 */

import { Plus, XIcon } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { capitalizeFirst } from "@/lib/utils/capitalize-first";
import { formatEUR } from "@/lib/api/labor";
import { LaborEntryCard } from "@/components/labor/labor-entry-card";
import type { LaborEntry } from "@/types/labor";

interface AttendanceDayDetailSheetProps {
  /** The day this sheet describes. Null = closed. */
  date: Date | null;
  /** Entries for this day. */
  entries: LaborEntry[];
  /** Open/close binding. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManage: boolean;
  onDelete: (entry: LaborEntry) => void;
  /** Tapping a card → opens EditAttendanceDialog. Optional. */
  onEdit?: (entry: LaborEntry) => void;
  /** "+ Log more" button → opens LogDayDialog for this date. Optional. */
  onAddMore?: () => void;
}

export function AttendanceDayDetailSheet({
  date,
  entries,
  open,
  onOpenChange,
  canManage,
  onDelete,
  onEdit,
  onAddMore,
}: AttendanceDayDetailSheetProps) {
  const dayTotal = entries.reduce(
    (sum, e) => sum + Number(e.effective_cost ?? 0),
    0,
  );

  // Localized header — "Mercredi 13/05/2026" in French. Falls back to
  // the browser locale when the user isn't viewing the French build.
  const heading = date
    ? capitalizeFirst(
        date.toLocaleDateString(undefined, {
          weekday: "long",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }),
        undefined,
      )
    : "";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/50",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            // Mobile: full width bottom — feels like a sheet from the
            // floor. Desktop: right-anchored panel ~420 px wide.
            "bg-background fixed z-50 flex flex-col gap-4 p-6 shadow-lg",
            "inset-x-0 bottom-0 max-h-[85vh] rounded-t-lg",
            "sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-none sm:w-[420px] sm:rounded-none sm:rounded-l-lg",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            // Mobile slide from bottom; desktop slide from right.
            "data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
            "sm:data-[state=open]:slide-in-from-right sm:data-[state=closed]:slide-out-to-right",
          )}
        >
          <DialogPrimitive.Title className="text-lg font-semibold leading-tight">
            {heading}
          </DialogPrimitive.Title>

          <DialogPrimitive.Description className="text-muted-foreground text-sm">
            {entries.length === 0 ? (
              <>No entries logged for this day.</>
            ) : (
              <>
                {entries.length} {entries.length === 1 ? "entry" : "entries"}{" "}
                &middot;{" "}
                <span className="text-foreground font-medium">
                  {formatEUR(dayTotal)}
                </span>{" "}
                total
              </>
            )}
          </DialogPrimitive.Description>

          <div className="flex-1 space-y-2 overflow-y-auto">
            {entries.map((entry) => (
              <LaborEntryCard
                key={entry.id}
                entry={entry}
                canManage={canManage}
                onDelete={onDelete}
                onEdit={canManage ? onEdit : undefined}
              />
            ))}
          </div>

          {canManage && onAddMore && (
            <Button onClick={onAddMore} variant="default" className="w-full">
              <Plus className="mr-1 h-4 w-4" />
              {entries.length === 0 ? "Log day" : "Log more workers"}
            </Button>
          )}

          <DialogPrimitive.Close
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100"
          >
            <XIcon className="h-4 w-4" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
