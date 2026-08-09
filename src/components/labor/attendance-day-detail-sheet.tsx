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

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus, XIcon, Pencil, Trash2, ClipboardList, Tag } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { capitalizeFirst } from "@/lib/utils/capitalize-first";
import { formatDate } from "@/lib/utils/formatters";
import { toDateKey } from "@/lib/utils/calendar-month";
import { formatEUR } from "@/lib/api/labor";
import { LaborEntryCard } from "@/components/labor/labor-entry-card";
import { DayDescriptionField } from "@/components/labor/day-description-field";
import { TagSelect } from "@/components/tags/tag-select";
import type { LaborEntry, LaborActivity } from "@/types/labor";
import type { ProjectTag } from "@/lib/api/tags";

interface AttendanceDayDetailSheetProps {
  /** The day this sheet describes. Null = closed. */
  date: Date | null;
  /** Entries for this day. */
  entries: LaborEntry[];
  /** Activities for this day. */
  activities?: LaborActivity[];
  /** Day-level description text (separate from per-worker notes and activities). */
  dayDescription?: string;
  /** Project-scoped phase tags. Empty = tagging UI hidden (existing convention). */
  tags?: ProjectTag[];
  /** Open/close binding. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManage: boolean;
  onDelete: (entry: LaborEntry) => void;
  /** Tapping a card → opens EditAttendanceDialog. Optional. */
  onEdit?: (entry: LaborEntry) => void;
  /** "+ Log more" button → opens LogDayDialog for this date. Optional. */
  onAddMore?: () => void;
  /** Activity CRUD callbacks. */
  onAddActivity?: () => void;
  onEditActivity?: (activity: LaborActivity) => void;
  onDeleteActivity?: (activity: LaborActivity) => void;
  /** Saves the day description (upsert). Caller refetches. */
  onSaveDayDescription?: (date: string, description: string) => Promise<void>;
  /**
   * Bulk-sets tag_id on every entry of this day (overwrite). Date is bound by
   * the caller (see AttendanceCalendar). Undefined hides the tag row.
   */
  onSaveDayTag?: (tagId: string | null) => Promise<void>;
}

export function AttendanceDayDetailSheet({
  date,
  entries,
  activities = [],
  dayDescription = "",
  tags = [],
  open,
  onOpenChange,
  canManage,
  onDelete,
  onEdit,
  onAddMore,
  onAddActivity,
  onEditActivity,
  onDeleteActivity,
  onSaveDayDescription,
  onSaveDayTag,
}: AttendanceDayDetailSheetProps) {
  const t = useTranslations("labor");
  const dayTotal = entries.reduce(
    (sum, e) => sum + Number(e.effective_cost ?? 0),
    0,
  );

  // Common tag across the day's entries; null when entries disagree (mixed)
  // or there are no entries yet. Tracks in-flight saves to disable the
  // picker while a bulk update is inflight.
  const commonTagId = useMemo(() => {
    if (entries.length === 0) return null;
    const first = entries[0].tag_id ?? null;
    const mixed = entries.some((e) => (e.tag_id ?? null) !== first);
    return mixed ? undefined : first;
  }, [entries]);
  const isMixed = commonTagId === undefined;
  const [savingTag, setSavingTag] = useState(false);

  const handleTagChange = async (tagId: string | null) => {
    if (!onSaveDayTag) return;
    setSavingTag(true);
    try {
      await onSaveDayTag(tagId);
    } catch {
      toast.error(t("dayTag.saveFailed"));
    } finally {
      setSavingTag(false);
    }
  };

  // Localized weekday + canonical dd/mm/YYYY date — "Mercredi 13/05/2026".
  // Weekday follows the browser locale; the numeric date is always dd/mm/YYYY.
  const heading = date
    ? `${capitalizeFirst(
        date.toLocaleDateString(undefined, { weekday: "long" }),
        undefined,
      )} ${formatDate(date)}`
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
              <>{t("noEntriesForDay")}</>
            ) : (
              <>
                {entries.length} {entries.length === 1 ? t("entrySingular") : t("entryPlural")}{" "}
                &middot;{" "}
                <span className="text-foreground font-medium">
                  {formatEUR(dayTotal)}
                </span>{" "}
                {t("total")}
              </>
            )}
          </DialogPrimitive.Description>

          <div className="flex-1 space-y-2 overflow-y-auto">
            {/* Day description — sits above worker cards, distinct from per-worker notes. */}
            {(dayDescription || (canManage && onSaveDayDescription)) && (
              /* Local-time key — toISOString() would shift to the previous
                 day for TZs ahead of UTC and save the description on the
                 wrong date. */
              <DayDescriptionField
                date={date ? toDateKey(date) : ""}
                value={dayDescription}
                canManage={canManage}
                onSave={onSaveDayDescription}
              />
            )}

            {/* "Tag this day" — bulk-sets tag_id on every entry of the day.
                Hidden when the project has no tags yet or the viewer can't
                manage labor (existing tags.length > 0 convention). */}
            {tags.length > 0 && canManage && onSaveDayTag && (
              <div
                data-testid="day-tag-select"
                className="space-y-1 px-1 pb-1 pt-0.5"
              >
                <Label className="text-muted-foreground flex items-center gap-1 text-xs font-medium">
                  <Tag className="h-3 w-3" />
                  {t("dayTag.label")}
                </Label>
                <TagSelect
                  tags={tags}
                  value={isMixed ? null : commonTagId}
                  onChange={handleTagChange}
                  disabled={savingTag}
                  placeholder={isMixed ? t("dayTag.mixed") : undefined}
                />
              </div>
            )}

            {entries.map((entry) => (
              <LaborEntryCard
                key={entry.id}
                entry={entry}
                canManage={canManage}
                onDelete={onDelete}
                onEdit={canManage ? onEdit : undefined}
              />
            ))}

            {activities.length > 0 && (
              <>
                {entries.length > 0 && <hr className="border-border my-2" />}
                <div className="flex items-center gap-1.5 pb-1">
                  <ClipboardList className="text-muted-foreground h-3.5 w-3.5" />
                  <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    {t("activity.sectionTitle")}
                  </span>
                </div>
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="bg-muted/30 rounded-md border p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{activity.title}</p>
                      </div>
                      {canManage && (
                        <div className="flex shrink-0 gap-1">
                          {onEditActivity && (
                            <button
                              type="button"
                              onClick={() => onEditActivity(activity)}
                              className="text-muted-foreground hover:text-foreground rounded p-1 transition-colors"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {onDeleteActivity && (
                            <button
                              type="button"
                              onClick={() => onDeleteActivity(activity)}
                              className="text-muted-foreground hover:text-destructive rounded p-1 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          <div className="flex gap-2">
            {canManage && onAddMore && (
              <Button onClick={onAddMore} variant="default" className="flex-1">
                <Plus className="mr-1 h-4 w-4" />
                {entries.length === 0 ? t("logDay") : t("logMoreWorkers")}
              </Button>
            )}
            {canManage && onAddActivity && (
              <Button onClick={onAddActivity} variant="outline" className="flex-1">
                <ClipboardList className="mr-1 h-4 w-4" />
                {t("activity.addTitle")}
              </Button>
            )}
          </div>

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
