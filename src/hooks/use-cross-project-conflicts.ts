"use client";

/**
 * useCrossProjectConflicts — fetch + cache cross-project conflict
 * groups for a target project + date (Phase 4 — cook 4c).
 *
 * The hook caches results per date in component state so the user
 * can ◀ / ▶ between dates without re-fetching the same day. Cache
 * size is unbounded but lives only for the dialog's lifetime, which
 * is at most a few minutes — fine.
 *
 * Surface:
 *   - `byPersonId`: map { person_id → ConflictGroup } for the active date
 *   - `isLoading`: true while the active date is being fetched
 *   - `error`: last fetch failure (or null)
 *   - `refetch()`: force a re-fetch for the active date (e.g. on save retry)
 *
 * Plan: 260512-2341-labor-calendar-and-bulk-log → phase-04 (4c).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { fetchCrossProjectConflicts } from "@/lib/api/labor";
import type { ConflictGroup } from "@/types/labor";

interface UseCrossProjectConflictsArgs {
  projectId: string;
  /** ISO YYYY-MM-DD. Falsy disables fetching. */
  date: string | undefined;
  /** When false, the hook is inert — no fetching, empty map. */
  enabled?: boolean;
}

interface UseCrossProjectConflictsResult {
  byPersonId: Map<string, ConflictGroup>;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

const EMPTY_MAP: Map<string, ConflictGroup> = new Map();

export function useCrossProjectConflicts({
  projectId,
  date,
  enabled = true,
}: UseCrossProjectConflictsArgs): UseCrossProjectConflictsResult {
  const [cache, setCache] = useState<Map<string, ConflictGroup[]>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const fetchTokenRef = useRef(0);

  const doFetch = useCallback(
    async (forDate: string) => {
      if (!enabled) return;
      const myToken = ++fetchTokenRef.current;
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetchCrossProjectConflicts(projectId, forDate);
        if (myToken !== fetchTokenRef.current) return; // stale
        setCache((prev) => {
          const next = new Map(prev);
          next.set(forDate, res.conflicts);
          return next;
        });
      } catch (err) {
        if (myToken !== fetchTokenRef.current) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (myToken === fetchTokenRef.current) setIsLoading(false);
      }
    },
    [projectId, enabled],
  );

  useEffect(() => {
    if (!enabled || !date) return;
    if (cache.has(date)) return;
    void doFetch(date);
  }, [enabled, date, cache, doFetch]);

  const byPersonId = useMemo(() => {
    if (!enabled || !date) return EMPTY_MAP;
    const list = cache.get(date);
    if (!list) return EMPTY_MAP;
    const m = new Map<string, ConflictGroup>();
    for (const g of list) m.set(g.person_id, g);
    return m;
  }, [enabled, date, cache]);

  const refetch = useCallback(() => {
    if (!date) return;
    setCache((prev) => {
      const next = new Map(prev);
      next.delete(date);
      return next;
    });
    void doFetch(date);
  }, [date, doFetch]);

  return { byPersonId, isLoading, error, refetch };
}
