"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import type { LaborEntry, Worker } from "@/types/labor";
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
      {/* Filters */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>{t("filterMonth")}</Label>
          <Input
            type="month"
            value={month}
            onChange={(e) => onMonthChange(e.target.value)}
          />
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
        const shiftLabel: Record<string, string> = {
          full: t("shiftFull"),
          half: t("shiftHalf"),
          overtime: t("shiftOvertime"),
        };
        const grouped = entries.reduce<Record<string, typeof entries>>((acc, e) => {
          (acc[e.date] ??= []).push(e);
          return acc;
        }, {});
        const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

        return (
          <div className="space-y-4">
            {sortedDates.map((date) => (
              <div key={date} className="space-y-1">
                {/* Date header */}
                <p className="text-sm font-semibold text-muted-foreground px-1">
                  {new Date(date).toLocaleDateString("fr-FR", {
                    weekday: "long",
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </p>

                {/* Worker rows */}
                {grouped[date].map((entry) => (
                  <Card key={entry.id}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{entry.worker_name}</span>
                          <Badge variant="secondary" className="text-xs">
                            {shiftLabel[entry.shift_type] ?? entry.shift_type}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-primary">
                            {formatEUR(entry.effective_cost)}
                          </span>
                          {entry.amount_override !== null && (
                            <span className="text-xs text-muted-foreground">
                              ({t("override")})
                            </span>
                          )}
                          {entry.note && (
                            <span className="text-muted-foreground">
                              — {entry.note}
                            </span>
                          )}
                        </div>
                      </div>

                      {canManage && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmDelete(entry)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ))}
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
