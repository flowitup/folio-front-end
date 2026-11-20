"use client";

/**
 * Closed labor months ("Chốt tháng", owner decision QĐ-10) for one project.
 *
 * The labor page owns the state (`useLaborMonthClosuresState`) and shares it
 * through `LaborMonthClosureContext`, so the Summary tab can show the closed
 * badge / close / reopen, and every dialog that saves into a month (log day,
 * edit day, record payment, assign a payment, rate change) can ask
 * "Tháng X đã chốt. Vẫn lưu?" first via `confirmWrite`.
 *
 * Closing locks nothing: confirming saves as usual and the API records the
 * change. Outside a provider (other pages, tests) nothing is closed and
 * `confirmWrite` answers true at once.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { useConfirm } from "@/hooks/use-confirm";
import { closeLaborMonth, fetchLaborMonthClosures, reopenLaborMonth } from "@/lib/api/labor";
import { closedMonthsFor, closedMonthsFromDate, formatClosureMonth } from "@/lib/labor/month-closure";
import type { LaborMonthClosure } from "@/types/labor";

export interface LaborMonthClosureApi {
  /** Closed months of the project, newest first. */
  closures: LaborMonthClosure[];
  /** Whether the caller may close / reopen (project:manage_labor). */
  canManage: boolean;
  closureFor: (month: string) => LaborMonthClosure | undefined;
  /**
   * Ask before a write lands in closed months. `days` are "YYYY-MM-DD" days or
   * "YYYY-MM" months; `fromDate` adds every closed month from that day on (a
   * dated rate change). Resolves true when nothing is closed or the user said
   * "save anyway".
   */
  confirmWrite: (days: ReadonlyArray<string | null | undefined>, fromDate?: string | null) => Promise<boolean>;
  close: (month: string) => Promise<LaborMonthClosure>;
  reopen: (month: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const NOTHING_CLOSED: LaborMonthClosureApi = {
  closures: [],
  canManage: false,
  closureFor: () => undefined,
  confirmWrite: async () => true,
  close: async () => {
    throw new Error("No LaborMonthClosureContext");
  },
  reopen: async () => {
    throw new Error("No LaborMonthClosureContext");
  },
  refresh: async () => {},
};

export const LaborMonthClosureContext = createContext<LaborMonthClosureApi>(NOTHING_CLOSED);

export function useLaborMonthClosures(): LaborMonthClosureApi {
  return useContext(LaborMonthClosureContext);
}

/**
 * State for the provider. `enabled`: the caller sees the whole project's
 * labor (manage_labor or view_pay) — anyone else gets 403 from the API, so
 * nothing is fetched. Render the returned `dialog` once, inside the page.
 */
export function useLaborMonthClosuresState({
  projectId,
  enabled,
  canManage,
}: {
  projectId: string;
  enabled: boolean;
  canManage: boolean;
}): { api: LaborMonthClosureApi; dialog: ReactNode } {
  const t = useTranslations("labor.monthClose");
  const { ask, dialog } = useConfirm();
  const [fetched, setFetched] = useState<LaborMonthClosure[]>([]);
  // Nothing is closed for a caller who may not read closures.
  const closures = useMemo(() => (enabled ? fetched : []), [enabled, fetched]);
  // confirmWrite reads the latest list even from a callback created earlier.
  const closuresRef = useRef<LaborMonthClosure[]>([]);
  useEffect(() => {
    closuresRef.current = closures;
  }, [closures]);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      setFetched(await fetchLaborMonthClosures(projectId));
    } catch {
      // Non-fatal: without the list the page simply shows no closed month.
    }
  }, [projectId, enabled]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetchLaborMonthClosures(projectId)
      .then((list) => {
        if (!cancelled) setFetched(list);
      })
      .catch(() => {
        // Non-fatal: without the list the page simply shows no closed month.
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, enabled]);

  const confirmWrite = useCallback(
    async (days: ReadonlyArray<string | null | undefined>, fromDate?: string | null) => {
      const months = Array.from(
        new Set([
          ...closedMonthsFor(closuresRef.current, days),
          ...(fromDate ? closedMonthsFromDate(closuresRef.current, fromDate) : []),
        ]),
      ).sort();
      if (months.length === 0) return true;
      return ask({
        title: t("writeTitle", { months: months.map(formatClosureMonth).join(", ") }),
        description: t("writeDescription"),
        confirmLabel: t("writeConfirm"),
      });
    },
    [ask, t],
  );

  const close = useCallback(
    async (month: string) => {
      const closure = await closeLaborMonth(projectId, month);
      await refresh();
      return closure;
    },
    [projectId, refresh],
  );

  const reopen = useCallback(
    async (month: string) => {
      await reopenLaborMonth(projectId, month);
      await refresh();
    },
    [projectId, refresh],
  );

  const api = useMemo<LaborMonthClosureApi>(
    () => ({
      closures,
      canManage,
      closureFor: (month: string) => closures.find((c) => c.month === month),
      confirmWrite,
      close,
      reopen,
      refresh,
    }),
    [closures, canManage, confirmWrite, close, reopen, refresh],
  );

  return { api, dialog };
}
