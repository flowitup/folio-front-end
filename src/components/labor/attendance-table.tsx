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
import { LaborEntryCard } from "@/components/labor/labor-entry-card";
import type { LaborEntry, Worker } from "@/types/labor";
import { capitalizeFirst } from "@/lib/utils/capitalize-first";
import { formatEUR } from "@/lib/api/labor";

interface AttendanceTableProps {
  entries: LaborEntry[];
  workers: Worker[];
  isLoading: boolean;
  canManage: boolean;
  month: string;
  workerFilter: string;
  onMonthChange: (value: string) => void;
  onWorkerFilterChange: (value: string) => void;
  onDelete: (entry: LaborEntry) => void;
}

export function AttendanceTable({
  entries,
  workers,
  isLoading,
  canManage,
  month,
  workerFilter,
  onMonthChange,
  onWorkerFilterChange,
  onDelete,
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
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Entries grouped by date */}
      {entries.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {t("noEntries")}
          </CardContent>
        </Card>
      ) : (() => {
        const grouped = entries.reduce<Record<string, typeof entries>>((acc, e) => {
          (acc[e.date] ??= []).push(e);
          return acc;
        }, {});
        const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

        return (
          <div className="space-y-6">
            {sortedDates.map((date) => {
              const dayEntries = grouped[date];
              const dayTotal = dayEntries.reduce(
                (sum, e) => sum + Number(e.effective_cost ?? 0),
                0,
              );
              return (
                <section key={date} className="space-y-2">
                  {/* Date header — French weekday is lowercased by Intl;
                      capitalize so the line reads "Samedi 09/05/2026". */}
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
                      <span>
                        {dayEntries.length}{" "}
                        {dayEntries.length === 1 ? "worker" : "workers"}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="text-foreground font-semibold tabular-nums">
                        {formatEUR(dayTotal)}
                      </span>
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
                    </div>
                  </Card>
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
