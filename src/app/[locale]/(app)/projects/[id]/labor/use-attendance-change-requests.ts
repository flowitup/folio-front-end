"use client";

/**
 * Manager side of worker change requests on the labor page: loads the open
 * requests for the project, merges in the ones carried by the loaded entries,
 * and applies / refuses them (refusing goes through a confirmation).
 *
 * The request list comes from two places because neither is complete alone:
 * the loaded entries only cover the viewed month (or the most recent rows),
 * while the bell feed covers every month but is capped server-side.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { ApiError } from "@/lib/api/http";
import { approveAttendanceChange, rejectAttendanceChange } from "@/lib/api/labor";
import { changeRequestFromEntry, mergeChangeRequests } from "@/lib/labor/change-requests";
import { hasChangeRequest, type AttendanceChangeRequest, type LaborEntry } from "@/types/labor";
import { fetchAttendanceChangeRequestsAction } from "./actions";

interface UseAttendanceChangeRequestsOptions {
  projectId: string;
  /** Only managers (project:manage_labor) load and decide change requests. */
  enabled: boolean;
  /** Entries loaded on the attendance tab — their open requests are merged in. */
  entries: LaborEntry[];
  /** Reloads what a decision changes on the page (the attendance entries). */
  onDecided: () => Promise<void> | void;
}

export function useAttendanceChangeRequests({
  projectId,
  enabled,
  entries,
  onDecided,
}: UseAttendanceChangeRequestsOptions) {
  const t = useTranslations("labor");
  const [feedRequests, setFeedRequests] = useState<AttendanceChangeRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  // Entry ids with a decision in flight: the ref blocks a second click at once,
  // the state disables the buttons on the next render.
  const settlingRef = useRef(new Set<string>());
  const [settlingIds, setSettlingIds] = useState<ReadonlySet<string>>(() => new Set());
  const [refusing, setRefusing] = useState<AttendanceChangeRequest | null>(null);

  const reload = useCallback(async () => {
    if (!enabled) return;
    setIsLoading(true);
    try {
      const result = await fetchAttendanceChangeRequestsAction(projectId);
      if (result.success) {
        setFeedRequests(result.data);
        setLoadFailed(false);
      } else {
        setLoadFailed(true);
      }
    } catch {
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const requests = useMemo(
    () =>
      enabled
        ? mergeChangeRequests(entries.filter(hasChangeRequest).map(changeRequestFromEntry), feedRequests)
        : [],
    [enabled, entries, feedRequests],
  );

  const markSettling = useCallback((entryId: string, settling: boolean) => {
    if (settling) settlingRef.current.add(entryId);
    else settlingRef.current.delete(entryId);
    setSettlingIds(new Set(settlingRef.current));
  }, []);

  /** Resolves true once the request is gone (decided now or already settled elsewhere). */
  const decide = useCallback(
    async (request: AttendanceChangeRequest, approve: boolean): Promise<boolean> => {
      if (settlingRef.current.has(request.entry_id)) return false;
      markSettling(request.entry_id, true);
      let settled = false;
      try {
        await (approve ? approveAttendanceChange : rejectAttendanceChange)(projectId, request.entry_id);
        toast.success(
          t(approve ? "changeRequest.applied" : "changeRequest.refused", { worker: request.worker_name }),
        );
        settled = true;
      } catch (err) {
        // 409: no request open any more; 404: the day was deleted. Either way
        // someone else settled it — refresh instead of reporting a failure.
        if (err instanceof ApiError && (err.status === 409 || err.status === 404)) {
          toast.info(t("changeRequest.alreadySettled", { worker: request.worker_name }));
          settled = true;
        } else {
          toast.error(t(approve ? "changeRequest.applyFailed" : "changeRequest.refuseFailed"));
        }
      }
      if (settled) {
        setFeedRequests((current) => current.filter((r) => r.entry_id !== request.entry_id));
        await Promise.allSettled([onDecided(), reload()]);
      }
      markSettling(request.entry_id, false);
      return settled;
    },
    [projectId, t, onDecided, reload, markSettling],
  );

  const approve = useCallback(
    (request: AttendanceChangeRequest) => {
      void decide(request, true);
    },
    [decide],
  );

  const requestRefuse = useCallback((request: AttendanceChangeRequest) => setRefusing(request), []);
  const cancelRefuse = useCallback(() => setRefusing(null), []);

  // The dialog stays open on a failure so the manager can retry from it.
  const confirmRefuse = useCallback(async () => {
    if (!refusing) return;
    if (await decide(refusing, false)) setRefusing(null);
  }, [refusing, decide]);

  return {
    requests,
    isLoading,
    loadFailed,
    reload,
    settlingIds,
    approve,
    refusing,
    requestRefuse,
    cancelRefuse,
    confirmRefuse,
  };
}
