"use client";

/**
 * useLaborPaymentNotes — the viewed month's per-worker notes on the Payments
 * tab (one free-text note per worker per month, e.g. why a month is still
 * unpaid), plus the save handler. A blank note clears it server-side.
 */

import { useCallback, useEffect, useState } from "react";
import { fetchLaborPaymentNotes, setLaborPaymentNote } from "@/lib/api/labor";

export function useLaborPaymentNotes(projectId: string, month: string) {
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    // Keep the same object when there is nothing to change, so a month with
    // no notes costs no extra render.
    const replace = (next: Record<string, string>) =>
      setNotes((prev) =>
        Object.keys(prev).length === 0 && Object.keys(next).length === 0 ? prev : next,
      );
    replace({});
    if (!month) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchLaborPaymentNotes(projectId, month);
        if (!cancelled) replace(Object.fromEntries(list.map((n) => [n.worker_id, n.note])));
      } catch {
        // Notes are secondary to the owed/paid table — a failed load leaves
        // the rows note-less rather than blocking the tab.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, month]);

  const saveNote = useCallback(
    async (workerId: string, note: string) => {
      const trimmed = note.trim();
      await setLaborPaymentNote(projectId, { worker_id: workerId, month, note: trimmed });
      setNotes((prev) => {
        const next = { ...prev };
        if (trimmed) next[workerId] = trimmed;
        else delete next[workerId];
        return next;
      });
    },
    [projectId, month],
  );

  return { notes, saveNote };
}

/** Key of a note in `useProjectLaborPaymentNotes` — month is "YYYY-MM". */
export function paymentNoteKey(workerId: string, month: string): string {
  return `${month}|${workerId}`;
}

/**
 * useProjectLaborPaymentNotes — every labor payment note on the project,
 * keyed by `paymentNoteKey`, for the Summary tab which shows one month or
 * the whole history.
 */
export function useProjectLaborPaymentNotes(projectId: string) {
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchLaborPaymentNotes(projectId);
        if (!cancelled && list.length > 0) {
          setNotes(Object.fromEntries(list.map((n) => [paymentNoteKey(n.worker_id, n.month), n.note])));
        }
      } catch {
        // Secondary to the summary figures — leave rows note-less on failure.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const saveNote = useCallback(
    async (workerId: string, month: string, note: string) => {
      const trimmed = note.trim();
      await setLaborPaymentNote(projectId, { worker_id: workerId, month, note: trimmed });
      const key = paymentNoteKey(workerId, month);
      setNotes((prev) => {
        const next = { ...prev };
        if (trimmed) next[key] = trimmed;
        else delete next[key];
        return next;
      });
    },
    [projectId],
  );

  return { notes, saveNote };
}
