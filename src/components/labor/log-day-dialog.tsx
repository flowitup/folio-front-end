"use client";

/**
 * LogDayDialog — bulk attendance logger (Phase 3c).
 *
 * Single dialog that logs N workers in one save:
 *  - DatePickerWithArrows header (◀ date ▶)
 *  - Search input filters tiles by name (case-insensitive)
 *  - "Same as last day" button copies the most recent day's selection
 *  - "Recent (last 7 days)" + "All workers" tile sections
 *  - Workers already logged for the picked date are pre-checked + locked
 *  - Save → POST /labor-entries/bulk; toast reports created+skipped
 *  - Toast carries a "Log next day →" action that bumps date by +1 and
 *    keeps the user's selection so multi-day backfills are one-click each
 *
 * State lives entirely in this component; the parent (LaborPage)
 * controls visibility + receives an onSaved() callback to re-fetch.
 *
 * Plan: 260512-2341-labor-calendar-and-bulk-log → phase-03 (3c).
 */

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LogDayTileGrid } from "@/components/labor/log-day-tile-grid";
import { CrossProjectConflictModal } from "@/components/labor/cross-project-conflict-modal";
import {
  DatePickerWithArrows,
  shiftDate,
} from "@/components/labor/date-picker-with-arrows";
import { useLastLoggedDay } from "@/hooks/use-last-logged-day";
import { useCrossProjectConflicts } from "@/hooks/use-cross-project-conflicts";
import {
  bulkLogAttendance,
  fetchLaborDayDescriptions,
  setLaborDayDescription,
} from "@/lib/api/labor";
import { ApiError } from "@/lib/api/http";
import {
  applyLastDayTemplate,
  buildBulkPayload,
  buildTileStates,
  partitionWorkers,
  recentWorkerSet,
  type TileStateMap,
} from "@/components/labor/log-day-dialog-state";
import type {
  BulkConflictError,
  ConflictGroup,
  LaborEntry,
  ShiftType,
  Worker,
} from "@/types/labor";

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

interface LogDayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  workers: Worker[];
  entries: LaborEntry[];
  /** Optional initial date when opened (defaults to today). */
  initialDate?: string;
  /** Re-fetch parent entries after a successful save. */
  onSaved: () => void;
}

export function LogDayDialog({
  open,
  onOpenChange,
  projectId,
  workers,
  entries,
  initialDate,
  onSaved,
}: LogDayDialogProps) {
  const t = useTranslations("labor.logDayDialog");
  const tLabor = useTranslations("labor");
  const tConflict = useTranslations("labor.conflict");
  const [date, setDate] = useState<string>(initialDate || todayKey());
  // Day-level description for the picked date (separate from per-worker notes).
  // Seeded from the backend whenever the dialog opens or the date changes, and
  // upserted on save. `initialDayDescription` lets us skip a write when unchanged.
  const [dayDescription, setDayDescription] = useState("");
  const [initialDayDescription, setInitialDayDescription] = useState("");
  const [search, setSearch] = useState("");
  const [tileStates, setTileStates] = useState<TileStateMap>({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastDay = useLastLoggedDay(entries);

  // Phase 4: conflict fetch + cache by date. The hook is enabled only
  // while the dialog is open so closed dialogs don't keep making
  // network calls on background re-renders.
  const conflicts = useCrossProjectConflicts({
    projectId,
    date,
    enabled: open,
  });

  // Pre-save confirmation modal state. `conflictGroups` is the subset
  // intersecting the user's current selection — only those are listed.
  const [pendingConflicts, setPendingConflicts] = useState<ConflictGroup[]>([]);
  const [showConflictModal, setShowConflictModal] = useState(false);

  // Reset / reseed tile states whenever the dialog opens or the
  // selected date changes. Locked set is recomputed from current
  // entries so prev-logged workers always surface.
  useEffect(() => {
    if (!open) return;
    setTileStates((prev) => {
      const next = buildTileStates(workers, entries, date);
      // Preserve checked + shift_type on unlocked tiles so "log next
      // day" survives date bumps. Locked tiles are always reseeded.
      for (const [id, s] of Object.entries(next)) {
        const carry = prev[id];
        if (carry && !s.locked && carry.checked && !carry.locked) {
          next[id] = {
            ...s,
            checked: true,
            shift_type: carry.shift_type,
            supplement_hours: carry.supplement_hours,
            amount_override: carry.amount_override,
            note: carry.note,
          };
        }
      }
      return next;
    });
    setError(null);
  }, [open, date, workers, entries]);

  // Seed the day description from the backend for the picked date.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchLaborDayDescriptions(projectId, { from: date, to: date });
        const desc = rows.find((r) => r.date === date)?.description ?? "";
        if (!cancelled) {
          setDayDescription(desc);
          setInitialDayDescription(desc);
        }
      } catch {
        // Non-fatal: leave the field empty if the lookup fails.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, date, projectId]);

  // When the dialog closes, reset transient state. Date sticks to the
  // initialDate prop for the next open.
  useEffect(() => {
    if (open) return;
    setSearch("");
    setError(null);
  }, [open]);

  useEffect(() => {
    if (open && initialDate) setDate(initialDate);
  }, [open, initialDate]);

  const recent = useMemo(
    () => recentWorkerSet(entries, date),
    [entries, date],
  );
  const { recent: recentList, rest } = useMemo(
    () => partitionWorkers(workers, recent, search),
    [workers, recent, search],
  );

  const checkedUnlockedCount = useMemo(
    () =>
      Object.values(tileStates).filter((s) => s.checked && !s.locked).length,
    [tileStates],
  );

  function toggleTile(workerId: string, next: boolean) {
    setTileStates((prev) => ({
      ...prev,
      [workerId]: { ...prev[workerId], checked: next },
    }));
  }

  function setShift(workerId: string, shift: ShiftType) {
    setTileStates((prev) => ({
      ...prev,
      [workerId]: { ...prev[workerId], shift_type: shift },
    }));
  }

  function toggleExpanded(workerId: string) {
    setTileStates((prev) => ({
      ...prev,
      [workerId]: { ...prev[workerId], expanded: !prev[workerId]?.expanded },
    }));
  }

  function setAmountOverride(workerId: string, next: number | undefined) {
    setTileStates((prev) => ({
      ...prev,
      [workerId]: { ...prev[workerId], amount_override: next },
    }));
  }

  function setSupplementHours(workerId: string, next: number) {
    setTileStates((prev) => ({
      ...prev,
      [workerId]: { ...prev[workerId], supplement_hours: next },
    }));
  }

  function setNote(workerId: string, next: string) {
    setTileStates((prev) => ({
      ...prev,
      [workerId]: { ...prev[workerId], note: next },
    }));
  }

  function handleSameAsLastDay() {
    if (!lastDay.date || lastDay.workers.length === 0) return;
    // Phase 4: strip workers in conflict so the convenience action
    // doesn't silently set up a duplicate-billing situation. Inform
    // via toast so the user knows what dropped out.
    const workersById = new Map(workers.map((w) => [w.id, w]));
    const accepted: typeof lastDay.workers = [];
    let skippedCount = 0;
    for (const sel of lastDay.workers) {
      const w = workersById.get(sel.worker_id);
      if (w?.person_id && conflicts.byPersonId.has(w.person_id)) {
        skippedCount += 1;
        continue;
      }
      accepted.push(sel);
    }
    setTileStates((prev) => applyLastDayTemplate(prev, accepted));
    if (skippedCount > 0) {
      toast.info(tConflict("sameAsLastDaySkipped", { n: skippedCount }));
    }
  }

  /**
   * Gather the conflict groups that intersect the user's current
   * selection — only those need confirmation. Locked tiles don't
   * count (they're already in the DB on this project).
   */
  function conflictsForSelection(): ConflictGroup[] {
    const out: ConflictGroup[] = [];
    for (const w of workers) {
      const s = tileStates[w.id];
      if (!s || !s.checked || s.locked || !w.person_id) continue;
      const g = conflicts.byPersonId.get(w.person_id);
      if (g) out.push(g);
    }
    return out;
  }

  async function doSave(acknowledge: boolean) {
    setError(null);
    const payload = buildBulkPayload(tileStates);
    if (payload.length === 0) {
      setError(t("selectAtLeastOne"));
      return;
    }
    setIsSaving(true);
    try {
      const res = await bulkLogAttendance(projectId, {
        date,
        entries: payload,
        acknowledge_conflicts: acknowledge || undefined,
      });
      // Persist the day description alongside the charges (only when changed).
      // Best-effort: charges are already committed, so a failed description
      // write must NOT mask the successful log — warn but continue.
      const nextDescription = dayDescription.trim();
      if (nextDescription !== initialDayDescription.trim()) {
        try {
          await setLaborDayDescription(projectId, { date, description: nextDescription });
          setInitialDayDescription(nextDescription);
        } catch {
          toast.warning(tLabor("dayDescription.saveFailed"));
        }
      }
      onSaved();
      const created = res.created.length;
      const skipped = res.skipped_worker_ids.length;
      const msg =
        skipped > 0
          ? t("toastLoggedWithSkip", { n: created, skipped })
          : t("toastLogged", { n: created });
      toast.success(msg, {
        action: {
          label: t("toastLogNextDay"),
          onClick: () => setDate((d) => shiftDate(d, 1)),
        },
      });
      setShowConflictModal(false);
      onOpenChange(false);
    } catch (err) {
      // Phase 4 race condition: a fresh conflict appeared between
      // dialog open and save. The server returns 409 with the latest
      // payload — surface the modal with that payload so the user can
      // re-confirm against accurate data.
      if (err instanceof ApiError && err.status === 409) {
        const body = err.data as BulkConflictError | undefined;
        if (body && Array.isArray(body.conflicts) && body.conflicts.length) {
          setPendingConflicts(body.conflicts);
          setShowConflictModal(true);
          conflicts.refetch();
          return;
        }
      }
      setError(err instanceof Error ? err.message : t("saveFailed"));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSave() {
    setError(null);
    if (!buildBulkPayload(tileStates).length) {
      setError(t("selectAtLeastOne"));
      return;
    }
    const inSelection = conflictsForSelection();
    if (inSelection.length > 0) {
      setPendingConflicts(inSelection);
      setShowConflictModal(true);
      return;
    }
    await doSave(false);
  }

  const canUseLastDay = lastDay.date !== null && lastDay.workers.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-3 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <DatePickerWithArrows
            value={date}
            onChange={setDate}
            label={t("dateLabel")}
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleSameAsLastDay}
            disabled={!canUseLastDay}
            title={
              canUseLastDay && lastDay.date
                ? t("sameAsLastDayHint", { date: lastDay.date })
                : t("noPreviousDay")
            }
          >
            {t("sameAsLastDay")}
          </Button>
        </div>

        <div className="relative">
          <Search className="text-muted-foreground absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="pl-8"
          />
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto pr-1">
          <LogDayTileGrid
            heading={t("sectionRecent")}
            workers={recentList}
            tileStates={tileStates}
            conflictsByPersonId={conflicts.byPersonId}
            showEmpty={false}
            onToggle={toggleTile}
            onShiftChange={setShift}
            onToggleExpanded={toggleExpanded}
            onAmountOverrideChange={setAmountOverride}
            onSupplementHoursChange={setSupplementHours}
            onNoteChange={setNote}
          />
          <LogDayTileGrid
            heading={t("sectionAll")}
            workers={rest}
            tileStates={tileStates}
            conflictsByPersonId={conflicts.byPersonId}
            onToggle={toggleTile}
            onShiftChange={setShift}
            onToggleExpanded={toggleExpanded}
            onAmountOverrideChange={setAmountOverride}
            onSupplementHoursChange={setSupplementHours}
            onNoteChange={setNote}
          />
        </div>

        {/* Day-level description — at the end, applies to the whole day's charges. */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="log-day-description"
            className="text-xs text-muted-foreground"
          >
            {tLabor("dayDescription.label")}
          </label>
          <Textarea
            id="log-day-description"
            value={dayDescription}
            onChange={(e) => setDayDescription(e.target.value)}
            placeholder={tLabor("dayDescription.placeholder")}
            rows={2}
            maxLength={2000}
          />
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            {tLabor("cancel")}
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving || checkedUnlockedCount === 0}
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("saveButton", { count: checkedUnlockedCount })}
          </Button>
        </DialogFooter>
      </DialogContent>
      <CrossProjectConflictModal
        open={showConflictModal}
        onOpenChange={(o) => {
          if (!o) setShowConflictModal(false);
        }}
        groups={pendingConflicts}
        isSaving={isSaving}
        onCancel={() => setShowConflictModal(false)}
        onConfirm={() => doSave(true)}
      />
    </Dialog>
  );
}
