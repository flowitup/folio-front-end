"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, X } from "lucide-react";
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
import { ConfirmDeleteDialog } from "@/components/labor/confirm-delete-dialog";
import { ClipboardList, Pencil, Trash2 as ActivityTrash } from "lucide-react";
import { LaborEntryCard, type ChangeRequestActions } from "@/components/labor/labor-entry-card";
import { DayDescriptionField } from "@/components/labor/day-description-field";
import type { LaborEntry, LaborActivity, LaborDayDescription, Worker } from "@/types/labor";
import { isPendingEntry } from "@/types/labor";
import { formatEUR } from "@/lib/api/labor";
import { formatWeekdayDate } from "@/lib/utils/formatters";

interface AttendanceTableProps {
  entries: LaborEntry[];
  workers: Worker[];
  activities?: LaborActivity[];
  dayDescriptions?: LaborDayDescription[];
  isLoading: boolean;
  canManage: boolean;
  month: string;
  workerFilter: string;
  onMonthChange: (value: string) => void;
  onWorkerFilterChange: (value: string) => void;
  onDelete: (entry: LaborEntry) => void;
  /** Manager actions on worker-submitted (pending) rows. */
  onValidate?: (entry: LaborEntry) => void;
  onReject?: (entry: LaborEntry) => void;
  /** Manager actions on a worker's change request (validated rows). */
  changeRequestActions?: ChangeRequestActions;
  onAddActivity?: (date: string) => void;
  onEditActivity?: (activity: LaborActivity) => void;
  onDeleteActivity?: (activity: LaborActivity) => void;
  onSaveDayDescription?: (date: string, description: string) => Promise<void>;
}

export function AttendanceTable({
  entries,
  workers,
  activities = [],
  dayDescriptions = [],
  isLoading,
  canManage,
  month,
  workerFilter,
  onMonthChange,
  onWorkerFilterChange,
  onDelete,
  onValidate,
  onReject,
  changeRequestActions,
  onAddActivity,
  onEditActivity,
  onDeleteActivity,
  onSaveDayDescription,
}: AttendanceTableProps) {
  const t = useTranslations("labor");
  const locale = useLocale();
  const [confirmDelete, setConfirmDelete] = useState<LaborEntry | null>(null);

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
                        {formatWeekdayDate(date, locale)}
                      </h3>
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
                            {dayEntries.every(isPendingEntry) ? "—" : formatEUR(dayTotal)}
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
                          onValidate={onValidate}
                          onReject={onReject}
                          changeRequestActions={changeRequestActions}
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
                                  aria-label={t("activity.editTitle")}
                                  title={t("activity.editTitle")}
                                  className="text-muted-foreground hover:text-foreground rounded p-1 transition-colors"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                              )}
                              {onDeleteActivity && (
                                <button
                                  type="button"
                                  onClick={() => onDeleteActivity(activity)}
                                  aria-label={t("delete")}
                                  title={t("delete")}
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
      <ConfirmDeleteDialog
        open={!!confirmDelete}
        title={t("confirmDelete")}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) {
            onDelete(confirmDelete);
            setConfirmDelete(null);
          }
        }}
      />
    </div>
  );
}
