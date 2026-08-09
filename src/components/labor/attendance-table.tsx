"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Trash2, X, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ClipboardList, Pencil, Trash2 as ActivityTrash } from "lucide-react";
import { LaborEntryCard } from "@/components/labor/labor-entry-card";
import { DayDescriptionField } from "@/components/labor/day-description-field";
import { TagSelect } from "@/components/tags/tag-select";
import type { LaborEntry, LaborActivity, LaborDayDescription, Worker } from "@/types/labor";
import type { ProjectTag } from "@/lib/api/tags";
import { capitalizeFirst } from "@/lib/utils/capitalize-first";
import { formatEUR } from "@/lib/api/labor";

interface AttendanceTableProps {
  entries: LaborEntry[];
  workers: Worker[];
  activities?: LaborActivity[];
  dayDescriptions?: LaborDayDescription[];
  /** Project-scoped phase tags. Empty = tagging UI hidden (existing convention). */
  tags?: ProjectTag[];
  isLoading: boolean;
  canManage: boolean;
  month: string;
  workerFilter: string;
  onMonthChange: (value: string) => void;
  onWorkerFilterChange: (value: string) => void;
  onDelete: (entry: LaborEntry) => void;
  onAddActivity?: (date: string) => void;
  onEditActivity?: (activity: LaborActivity) => void;
  onDeleteActivity?: (activity: LaborActivity) => void;
  onSaveDayDescription?: (date: string, description: string) => Promise<void>;
  /** Bulk-sets tag_id on every entry of the given day (overwrite). */
  onSaveDayTag?: (date: string, tagId: string | null) => Promise<void>;
}

/** Day-header tag action: icon button opening a Popover with TagSelect. */
function DayTagAction({
  date,
  dayEntries,
  tags,
  onSaveDayTag,
}: {
  date: string;
  dayEntries: LaborEntry[];
  tags: ProjectTag[];
  onSaveDayTag: (date: string, tagId: string | null) => Promise<void>;
}) {
  const t = useTranslations("labor");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const commonTagId = (() => {
    if (dayEntries.length === 0) return null;
    const first = dayEntries[0].tag_id ?? null;
    const mixed = dayEntries.some((e) => (e.tag_id ?? null) !== first);
    return mixed ? undefined : first;
  })();
  const isMixed = commonTagId === undefined;

  const handleChange = async (tagId: string | null) => {
    setSaving(true);
    try {
      await onSaveDayTag(date, tagId);
    } finally {
      setSaving(false);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          aria-label={t("dayTag.action")}
          title={t("dayTag.action")}
        >
          <Tag className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="end">
        <div className="space-y-1.5" data-testid="day-tag-popover">
          <Label className="text-muted-foreground text-xs font-medium">
            {t("dayTag.label")}
          </Label>
          <TagSelect
            tags={tags}
            value={isMixed ? null : commonTagId}
            onChange={handleChange}
            disabled={saving}
            placeholder={isMixed ? t("dayTag.mixed") : undefined}
            mixed={isMixed}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Day-header tag badges: single tag → color+name; multiple distinct → dots. */
function DayTagBadges({
  dayEntries,
  tagMap,
}: {
  dayEntries: LaborEntry[];
  tagMap: Record<string, ProjectTag>;
}) {
  const seen = new Set<string>();
  const distinctTags: ProjectTag[] = [];
  for (const e of dayEntries) {
    if (!e.tag_id || seen.has(e.tag_id)) continue;
    const tag = tagMap[e.tag_id];
    if (!tag) continue;
    seen.add(e.tag_id);
    distinctTags.push(tag);
  }

  if (distinctTags.length === 0) return null;

  if (distinctTags.length === 1) {
    const tag = distinctTags[0];
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white"
        style={{ backgroundColor: tag.color }}
      >
        {tag.name}
      </span>
    );
  }

  // Mixed tags on the same day — dots only (max 3 + overflow), no labels.
  const shown = distinctTags.slice(0, 3);
  const overflow = distinctTags.length - shown.length;
  return (
    <span
      data-testid="day-tag-dots-mixed"
      className="inline-flex items-center gap-0.5"
    >
      {shown.map((tag) => (
        <span
          key={tag.id}
          title={tag.name}
          aria-hidden="true"
          className="inline-block h-2 w-2 flex-shrink-0 rounded-full"
          style={{ backgroundColor: tag.color }}
        />
      ))}
      {overflow > 0 && (
        <span className="text-muted-foreground text-[9px] font-medium">
          +{overflow}
        </span>
      )}
    </span>
  );
}

export function AttendanceTable({
  entries,
  workers,
  activities = [],
  dayDescriptions = [],
  tags = [],
  isLoading,
  canManage,
  month,
  workerFilter,
  onMonthChange,
  onWorkerFilterChange,
  onDelete,
  onAddActivity,
  onEditActivity,
  onDeleteActivity,
  onSaveDayDescription,
  onSaveDayTag,
}: AttendanceTableProps) {
  const t = useTranslations("labor");
  const [confirmDelete, setConfirmDelete] = useState<LaborEntry | null>(null);
  const tagMap = Object.fromEntries(tags.map((tag) => [tag.id, tag]));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters — month is optional. Empty = all history. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>{t("filterMonthOptional")}</Label>
          <div className="flex items-center gap-2">
            <Input
              type="month"
              value={month}
              onChange={(e) => onMonthChange(e.target.value)}
              placeholder={t("filterMonthAll")}
            />
            {month && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onMonthChange("")}
                aria-label={t("filterMonthClear")}
                title={t("filterMonthClear")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <div className="space-y-1">
          <Label>{t("filterWorker")}</Label>
          <Select value={workerFilter} onValueChange={onWorkerFilterChange}>
            <SelectTrigger>
              <SelectValue placeholder={t("filterWorker")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filterWorkerAll")}</SelectItem>
              {workers.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.person_name ?? w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Entries + activities grouped by date */}
      {(() => {
        const grouped = entries.reduce<Record<string, typeof entries>>((acc, e) => {
          (acc[e.date] ??= []).push(e);
          return acc;
        }, {});
        const activitiesByDay = activities.reduce<Record<string, LaborActivity[]>>((acc, a) => {
          (acc[a.date] ??= []).push(a);
          return acc;
        }, {});
        // Build a date → description string map for O(1) lookups.
        const descriptionByDay = dayDescriptions.reduce<Record<string, string>>((acc, d) => {
          acc[d.date] = d.description;
          return acc;
        }, {});
        const allDates = new Set([
          ...Object.keys(grouped),
          ...Object.keys(activitiesByDay),
          ...Object.keys(descriptionByDay),
        ]);
        const sortedDates = [...allDates].sort((a, b) => b.localeCompare(a));

        if (sortedDates.length === 0) {
          return (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {t("noEntries")}
              </CardContent>
            </Card>
          );
        }

        return (
          <div className="space-y-6">
            {sortedDates.map((date) => {
              const dayEntries = grouped[date] ?? [];
              const dayActivities = activitiesByDay[date] ?? [];
              const dayTotal = dayEntries.reduce(
                (sum, e) => sum + Number(e.effective_cost ?? 0),
                0,
              );
              const dayDescription = descriptionByDay[date] ?? "";
              return (
                <section key={date} className="space-y-2">
                  <header className="flex items-baseline justify-between gap-3 px-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-foreground text-sm font-semibold tracking-tight">
                        {capitalizeFirst(
                          new Date(date).toLocaleDateString("fr-FR", {
                            weekday: "long",
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          }),
                          "fr-FR",
                        )}
                      </h3>
                      <DayTagBadges dayEntries={dayEntries} tagMap={tagMap} />
                      {tags.length > 0 && canManage && onSaveDayTag && (
                        <DayTagAction
                          date={date}
                          dayEntries={dayEntries}
                          tags={tags}
                          onSaveDayTag={onSaveDayTag}
                        />
                      )}
                    </div>
                    <div className="text-muted-foreground flex items-center gap-2 text-xs">
                      {dayEntries.length > 0 && (
                        <>
                          <span>
                            {dayEntries.length}{" "}
                            {dayEntries.length === 1 ? t("workerSingular") : t("workerPlural")}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="text-foreground font-semibold tabular-nums">
                            {formatEUR(dayTotal)}
                          </span>
                        </>
                      )}
                      {dayActivities.length > 0 && (
                        <>
                          {dayEntries.length > 0 && <span aria-hidden="true">·</span>}
                          <span>
                            {dayActivities.length}{" "}
                            {dayActivities.length === 1 ? t("activity.countSingular") : t("activity.countPlural")}
                          </span>
                        </>
                      )}
                    </div>
                  </header>

                  <DayDescriptionField
                    date={date}
                    value={dayDescription}
                    canManage={canManage}
                    onSave={onSaveDayDescription}
                  />

                  <Card className="overflow-hidden p-0">
                    <div className="divide-border divide-y">
                      {dayEntries.map((entry) => (
                        <LaborEntryCard
                          key={entry.id}
                          entry={entry}
                          canManage={canManage}
                          onDelete={(e) => setConfirmDelete(e)}
                        />
                      ))}
                      {dayActivities.map((activity) => (
                        <div key={activity.id} className="flex items-start gap-3 px-4 py-3">
                          <ClipboardList className="text-accent-foreground mt-0.5 h-4 w-4 shrink-0" />
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
                                  <ActivityTrash className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </Card>

                  {canManage && onAddActivity && (
                    <div className="px-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onAddActivity(date)}
                        className="text-muted-foreground h-auto py-1 text-xs"
                      >
                        <ClipboardList className="mr-1 h-3 w-3" />
                        {t("activity.addTitle")}
                      </Button>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        );
      })()}

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <AlertDialogContent className="max-w-sm">
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <Trash2 className="h-6 w-6 text-destructive" />
            </div>
            <AlertDialogTitle className="text-center">
              {t("confirmDelete")}
            </AlertDialogTitle>
          </div>
          <AlertDialogFooter className="sm:justify-center gap-2">
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDelete) {
                  onDelete(confirmDelete);
                  setConfirmDelete(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
