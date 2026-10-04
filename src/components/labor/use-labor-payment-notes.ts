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
