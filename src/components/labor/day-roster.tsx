"use client";

/**
 * DayRoster — the member-safe view of a project's day (D3): name, presence,
 * hours, day type. NEVER rate/cost/amount/total — the backend response
 * (`RosterRowResponse`) does not even include those fields, so there is no
 * risk of a UI slip leaking pay data here.
 *
 * Date defaults to today and is browsable (prev/next/today) — this is also
 * how a member reviews their own recent days without a dedicated "history"
 * endpoint (the roster GET is the only member-safe labor read the backend
 * exposes; a same-project member sees every worker's row, not just their own
 * — matches D3's "day roster" wording, which is a team view, not a private
 * one).
 */

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchDayRosterAction } from "@/app/[locale]/(app)/projects/[id]/labor/actions";
import type { RosterRow } from "@/lib/api/roster";
import type { ShiftType } from "@/types/labor";

interface Props {
  projectId: string;
  /**
   * "Today" as a YYYY-MM-DD string, computed server-side by the labor page
   * (page.tsx) and threaded down through LaborPageClient. Required — the
   * initial roster date must never come from `new Date()` during render:
   * this component sits inside a client-rendered tree, so a lazy
   * `useState(() => new Date())` initializer runs during BOTH the SSR pass
   * (container clock) and hydration (browser clock), which can disagree
   * across midnight and produce a React #418 hydration mismatch.
   */
  initialDate: string;
}

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(dateKey: string, delta: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const next = new Date(y, (m ?? 1) - 1, (d ?? 1) + delta);
  return toDateKey(next);
}

export function DayRoster({ projectId, initialDate }: Props) {
  const t = useTranslations("labor.roster");
  // Same shift labels used everywhere else labor entries show a day type
  // (worker-tile, labor-entry-card, edit-attendance-dialog) — lives at the
  // "labor" namespace root, not "labor.roster".
  const tShift = useTranslations("labor");
  const [date, setDate] = useState(initialDate);
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetches for an explicit date rather than reading `date` state — called
  // both on mount (effect, deps=[projectId] only) and directly from the
  // prev/next/today handlers (event, not a `date`-keyed effect). Avoids an
  // effect that both depends on local state and sets local state, which is
  // the classic "you might not need an effect" cascading-render shape.
  const load = useCallback(async (targetDate: string) => {
    setIsLoading(true);
    setError(null);
    const result = await fetchDayRosterAction(projectId, targetDate);
    if (result.success) {
      setRows(result.data.rows);
    } else {
      setRows([]);
      setError(result.error);
    }
    setIsLoading(false);
  }, [projectId]);

  useEffect(() => {
    void load(initialDate);
    // Mount-only: subsequent date changes are fetched directly from the
    // prev/next/today click handlers below, not by reacting to `date`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  function changeDate(next: string) {
    setDate(next);
    void load(next);
  }

  function statusLabel(status: RosterRow["status"]): string {
    return status === "present" ? t("statusPresent") : status === "pending" ? t("statusPending") : t("statusAbsent");
  }

  const shiftLabels: Record<ShiftType, string> = {
    full: tShift("shiftFull"),
    half: tShift("shiftHalf"),
    overtime: tShift("shiftOvertime"),
  };

  function dayTypeLabel(dayType: RosterRow["day_type"]): string {
    if (dayType === "full" || dayType === "half" || dayType === "overtime") {
      return shiftLabels[dayType];
    }
    return dayType ?? "—";
  }

  // Compares against the server-computed page-load date, not a fresh
  // `new Date()` — keeps this render-time value stable across SSR and
  // hydration (see the Props doc comment above). A day boundary crossed
  // while the tab stays open resolves on the next full page load, same
  // tradeoff as the existing 09:00 UTC anchor used elsewhere for
  // date-only concepts.
  const isToday = date === initialDate;

  return (
    <div className="folio-card p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-display text-[18px] font-medium tracking-tight">{t("title")}</h3>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => changeDate(addDays(date, -1))}>
            <ChevronLeft size={14} />
          </Button>
          <span className="num min-w-[100px] text-center text-[13px]">{date}</span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            disabled={isToday}
            onClick={() => changeDate(addDays(date, 1))}
          >
            <ChevronRight size={14} />
          </Button>
          {!isToday && (
            <Button variant="ghost" size="sm" onClick={() => changeDate(toDateKey(new Date()))}>
              {t("today")}
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={20} className="animate-spin" style={{ color: "var(--muted)" }} />
        </div>
      ) : error ? (
        <p className="py-10 text-center text-[13px]" style={{ color: "var(--muted)" }}>
          {t("loadError")}
        </p>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-[13px]" style={{ color: "var(--muted)" }}>
          {t("empty")}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("col.name")}</TableHead>
              <TableHead>{t("col.status")}</TableHead>
              <TableHead>{t("col.hours")}</TableHead>
              <TableHead>{t("col.dayType")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.worker_id}>
                <TableCell className="text-[13px] font-medium">{row.name}</TableCell>
                <TableCell>
                  <span
                    className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                    style={
                      row.status === "present"
                        ? { background: "var(--accent)", color: "white" }
                        : row.status === "pending"
                          ? { background: "var(--surface-2, #eee)", color: "var(--muted)" }
                          : { background: "var(--negative-tint, #fee)", color: "var(--negative)" }
                    }
                  >
                    {statusLabel(row.status)}
                  </span>
                </TableCell>
                <TableCell className="num text-[13px]">{row.hours}</TableCell>
                <TableCell className="text-[13px]" style={{ color: "var(--muted)" }}>
                  {dayTypeLabel(row.day_type)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
