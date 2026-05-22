"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Trash2, X } from "lucide-react";
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
import type { LaborEntry, LaborActivity, Worker } from "@/types/labor";
import { capitalizeFirst } from "@/lib/utils/capitalize-first";
import { formatEUR } from "@/lib/api/labor";

interface AttendanceTableProps {
  entries: LaborEntry[];
  workers: Worker[];
  activities?: LaborActivity[];
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
}

export function AttendanceTable({
  entries,
  workers,
  activities = [],
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
}: AttendanceTableProps) {
  const t = useTranslations("labor");
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
              <SelectItem value="all">{t("filterWorker")}</SelectItem>
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
        const allDates = new Set([...Object.keys(grouped), ...Object.keys(activitiesByDay)]);
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
              return (
                <section key={date} className="space-y-2">
                  <header className="flex items-baseline justify-between gap-3 px-1">
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
                    <div className="text-muted-foreground flex items-center gap-2 text-xs">
                      {dayEntries.length > 0 && (
                        <>
                          <span>
                            {dayEntries.length}{" "}
                            {dayEntries.length === 1 ? "worker" : "workers"}
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
                            {dayActivities.length === 1 ? "activity" : "activities"}
                          </span>
                        </>
                      )}
                    </div>
                  </header>

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
                          <ClipboardList className="text-blue-500 mt-0.5 h-4 w-4 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">{activity.title}</p>
                            {activity.description && (
                              <p className="text-muted-foreground mt-0.5 text-xs">
                                {activity.description}
                              </p>
                            )}
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
