/**
 * LogDayDialog state helpers (Phase 3c).
 *
 * Pure functions extracted from log-day-dialog.tsx so the orchestrator
 * stays under the 200-LOC file budget. All functions are side-effect
 * free + memoizable; tests can exercise them without rendering.
 *
 * Plan: 260512-2341-labor-calendar-and-bulk-log → phase-03 (3c).
 */

import type { BulkLogEntry, LaborEntry, ShiftType, Worker } from "@/types/labor";
import type { LastDayWorkerSelection } from "@/hooks/use-last-logged-day";

interface WorkerTileState {
  checked: boolean;
  /** Already-logged on the current date — tile is muted, click is no-op. */
  locked: boolean;
  shift_type: ShiftType;
  amount_override?: number;
  note?: string;
  supplement_hours?: number;
  expanded: boolean;
}

export type TileStateMap = Record<string, WorkerTileState>;

/**
 * Build the tile-state map for the dialog's worker list. Workers
 * already logged on `date` come back checked + locked so the user
 * can't double-log them; the lock badge surfaces the reason.
 */
export function buildTileStates(
  workers: Worker[],
  entries: LaborEntry[],
  date: string,
): TileStateMap {
  const lockedSet = new Set<string>();
  for (const e of entries) {
    if (e.date === date) lockedSet.add(e.worker_id);
  }
  const out: TileStateMap = {};
  for (const w of workers) {
    const locked = lockedSet.has(w.id);
    out[w.id] = {
      checked: locked,
      locked,
      shift_type: "full",
      expanded: false,
    };
  }
  return out;
}

/**
 * Apply the "Same as last day" template — set checked + shift on each
 * worker in `template`, leave locked tiles alone (they're already
 * marked, and shift_type on a logged entry isn't ours to change).
 */
export function applyLastDayTemplate(
  prev: TileStateMap,
  template: LastDayWorkerSelection[],
): TileStateMap {
  const next: TileStateMap = { ...prev };
  for (const sel of template) {
    const existing = next[sel.worker_id];
    if (!existing || existing.locked) continue;
    next[sel.worker_id] = {
      ...existing,
      checked: true,
      shift_type: (sel.shift_type ?? "full") as ShiftType,
      supplement_hours: sel.supplement_hours || undefined,
    };
  }
  return next;
}

/**
 * Workers who logged ANY entry in the last 7 days from `today` (a
 * YYYY-MM-DD string). Returns a Set of worker IDs so the dialog can
 * partition its grid into "Recent" + "All".
 */
export function recentWorkerSet(entries: LaborEntry[], today: string): Set<string> {
  // Compute the boundary date (today - 7 days) without touching tz.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today);
  if (!m) return new Set();
  const [, y, mo, d] = m.map(Number);
  const t = new Date(Date.UTC(y, mo - 1, d));
  t.setUTCDate(t.getUTCDate() - 7);
  const yy = t.getUTCFullYear();
  const mm = String(t.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(t.getUTCDate()).padStart(2, "0");
  const boundary = `${yy}-${mm}-${dd}`;
  const out = new Set<string>();
  for (const e of entries) {
    if (e.date >= boundary) out.add(e.worker_id);
  }
  return out;
}

/**
 * Filter + partition workers for rendering. `search` is matched
 * case-insensitively against person_name (fallback name). Active-only.
 */
export function partitionWorkers(
  workers: Worker[],
  recent: Set<string>,
  search: string,
): { recent: Worker[]; rest: Worker[] } {
  const q = search.trim().toLowerCase();
  const visible = workers
    .filter((w) => w.is_active)
    .filter((w) => {
      if (!q) return true;
      const name = (w.person_name ?? w.name ?? "").toLowerCase();
      return name.includes(q);
    });
  // Sort alpha within each bucket.
  visible.sort((a, b) =>
    (a.person_name ?? a.name ?? "").localeCompare(b.person_name ?? b.name ?? ""),
  );
  return {
    recent: visible.filter((w) => recent.has(w.id)),
    rest: visible.filter((w) => !recent.has(w.id)),
  };
}

/**
 * Build the bulk-log payload from the current tile state. Only
 * un-locked, checked tiles are saved — locked ones are already in
 * the DB and would be skipped server-side anyway, but filtering FE
 * side keeps the request small.
 */
export function buildBulkPayload(states: TileStateMap): BulkLogEntry[] {
  const out: BulkLogEntry[] = [];
  for (const [worker_id, s] of Object.entries(states)) {
    if (!s.checked || s.locked) continue;
    const entry: BulkLogEntry = {
      worker_id,
      shift_type: s.shift_type,
    };
    if (s.supplement_hours && s.supplement_hours > 0) {
      entry.supplement_hours = s.supplement_hours;
    }
    if (s.amount_override !== undefined && s.amount_override !== null) {
      entry.amount_override = s.amount_override;
    }
    if (s.note && s.note.trim()) {
      entry.note = s.note.trim();
    }
    out.push(entry);
  }
  return out;
}
