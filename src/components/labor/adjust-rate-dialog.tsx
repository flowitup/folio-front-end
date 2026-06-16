"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import type { Worker } from "@/types/labor";
import type { WorkerRateChange } from "@/types/labor";
import {
  fetchWorkerRateChanges,
  createWorkerRateChange,
  deleteWorkerRateChange,
  formatEUR,
} from "@/lib/api/labor";

interface AdjustRateDialogProps {
  projectId: string;
  worker: Worker | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a rate change is successfully added or deleted. */
  onChanged?: () => void;
}

/** Return today's date as ISO YYYY-MM-DD in local time. */
function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * AdjustRateDialog — schedule a per-worker pay-rate increase.
 *
 * Opens from the worker tile action bar (TrendingUp icon). On open it fetches
 * the existing rate-change history (ordered DESC), lets the manager add a new
 * entry with an effective date, and allows deleting any existing entry.
 *
 * Loading state notes:
 * - `isRefreshing` is true only during user-triggered re-fetches (after add or
 *   delete), not during the initial silent load on open. This avoids a jarring
 *   spinner flash when the dialog opens and the network is fast.
 */
export function AdjustRateDialog({
  projectId,
  worker,
  open,
  onOpenChange,
  onChanged,
}: AdjustRateDialogProps) {
  const t = useTranslations("labor");
  const locale = useLocale();

  const [rateChanges, setRateChanges] = useState<WorkerRateChange[]>([]);
  // isRefreshing: true only during user-triggered re-fetches (add / delete),
  // so the initial silent load on open does not flash a spinner.
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [newRate, setNewRate] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(todayIso());

  // Silently load history whenever the dialog opens with a valid worker.
  // No loading spinner here — the initial fetch is fast and the empty state
  // is the correct interim view while data arrives.
  useEffect(() => {
    if (!open || !worker) {
      setRateChanges([]);
      setError(null);
      setNewRate("");
      setEffectiveDate(todayIso());
      return;
    }

    let cancelled = false;

    async function load() {
      if (!worker) return;
      try {
        const list = await fetchWorkerRateChanges(projectId, worker.id);
        if (!cancelled) setRateChanges(list);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t("rateChange.errorGeneric"));
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
    // `t` (from useTranslations) is intentionally omitted from deps: it is
    // a stable reference in next-intl and including it would cause the effect
    // to re-run on every render (test mocks return a new fn each call).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, worker, projectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const rate = parseFloat(newRate);
    if (isNaN(rate) || rate <= 0) {
      setError(t("rateChange.errorRatePositive"));
      return;
    }
    if (!worker) return;

    setIsSaving(true);
    setIsRefreshing(true);
    try {
      await createWorkerRateChange(projectId, worker.id, {
        effective_date: effectiveDate,
        daily_rate: rate,
      });
      const list = await fetchWorkerRateChanges(projectId, worker.id);
      setRateChanges(list);
      setNewRate("");
      setEffectiveDate(todayIso());
      toast.success(t("rateChange.addedToast"));
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("rateChange.errorGeneric"));
    } finally {
      setIsSaving(false);
      setIsRefreshing(false);
    }
  };

  const handleDelete = async (rcId: string) => {
    if (!worker) return;
    setDeletingId(rcId);
    setIsRefreshing(true);
    try {
      await deleteWorkerRateChange(projectId, worker.id, rcId);
      const list = await fetchWorkerRateChanges(projectId, worker.id);
      setRateChanges(list);
      toast.success(t("rateChange.deletedToast"));
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("rateChange.errorGeneric"));
    } finally {
      setDeletingId(null);
      setIsRefreshing(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("rateChange.title")}</DialogTitle>
        </DialogHeader>

        {worker && (
          <p className="text-sm text-muted-foreground">
            {t("rateChange.current")}:{" "}
            <span className="font-medium tabular-nums text-foreground">
              {formatEUR(worker.current_daily_rate ?? worker.daily_rate)}
            </span>
          </p>
        )}

        {/* Add rate change form */}
        <form onSubmit={handleSubmit} className="space-y-4" data-testid="adjust-rate-form">
          <div className="space-y-2">
            <Label htmlFor="adjust-rate-amount">{t("rateChange.newRate")}</Label>
            <Input
              id="adjust-rate-amount"
              type="number"
              step="0.01"
              min="0"
              value={newRate}
              onChange={(e) => setNewRate(e.target.value)}
              placeholder="0.00"
              data-testid="adjust-rate-amount"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="adjust-rate-date">{t("rateChange.effectiveDate")}</Label>
            <Input
              id="adjust-rate-date"
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              data-testid="adjust-rate-date"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("rateChange.add")}
            </Button>
          </div>
        </form>

        {/* History */}
        <div className="space-y-2" data-testid="adjust-rate-history">
          <h4 className="text-sm font-medium">{t("rateChange.history")}</h4>

          {isRefreshing ? (
            <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : rateChanges.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("rateChange.noChanges")}
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-md border" role="list">
              {rateChanges.map((rc) => (
                <li
                  key={rc.id}
                  className="flex items-center justify-between px-3 py-2 text-sm"
                  data-testid={`rate-change-row-${rc.id}`}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium tabular-nums">
                      {formatEUR(rc.daily_rate)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t("rateChange.effectiveFrom", {
                        date: new Intl.DateTimeFormat(locale, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        }).format(new Date(rc.effective_date + "T00:00:00")),
                      })}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    aria-label={t("rateChange.delete")}
                    disabled={deletingId === rc.id}
                    onClick={() => void handleDelete(rc.id)}
                    data-testid={`delete-rate-change-${rc.id}`}
                  >
                    {deletingId === rc.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
