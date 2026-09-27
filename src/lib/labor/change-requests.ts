/**
 * Worker change requests on validated attendance days — shared helpers for the
 * labor page (entry cards, change-request panel) and the notifications bell.
 *
 * A worker proposes a correction from the mobile app; the day keeps its priced
 * values and carries `proposed_*` until a manager applies or refuses it.
 */

import type { AttendancePending } from "@/lib/api/notifications";
import type { AttendanceChangeRequest, LaborEntry, ShiftType } from "@/types/labor";

/** A `labor` namespace translator (next-intl `useTranslations("labor")`). */
type LaborTranslate = (key: string, values?: Record<string, string | number>) => string;

/** Review shape of an entry's open change request. Call only when `hasChangeRequest(entry)`. */
export function changeRequestFromEntry(entry: LaborEntry): AttendanceChangeRequest {
  return {
    entry_id: entry.id,
    worker_id: entry.worker_id,
    worker_name: entry.worker_name,
    date: entry.date,
    shift_type: entry.shift_type,
    supplement_hours: entry.supplement_hours,
    note: entry.note,
    proposed_shift_type: entry.proposed_shift_type ?? null,
    proposed_supplement_hours: entry.proposed_supplement_hours ?? 0,
    proposed_note: entry.proposed_note ?? null,
    requested_at: entry.change_requested_at ?? null,
  };
}

/** Review shape of a bell feed `attendance_change` item (its `submitted_at` is the request time). */
export function changeRequestFromFeedItem(item: AttendancePending): AttendanceChangeRequest {
  return {
    entry_id: item.entry_id,
    worker_id: item.worker_id,
    worker_name: item.worker_name,
    date: item.date,
    shift_type: item.shift_type,
    supplement_hours: item.supplement_hours,
    note: item.note,
    proposed_shift_type: item.proposed_shift_type ?? null,
    proposed_supplement_hours: item.proposed_supplement_hours ?? 0,
    proposed_note: item.proposed_note ?? null,
    requested_at: item.submitted_at,
  };
}

/**
 * One request per entry across several sources (the first source wins on a
 * duplicate), most recent day first, then by worker name.
 */
export function mergeChangeRequests(...sources: AttendanceChangeRequest[][]): AttendanceChangeRequest[] {
  const byEntry = new Map<string, AttendanceChangeRequest>();
  for (const source of sources) {
    for (const request of source) {
      if (!byEntry.has(request.entry_id)) byEntry.set(request.entry_id, request);
    }
  }
  return [...byEntry.values()].sort(
    (a, b) => b.date.localeCompare(a.date) || a.worker_name.localeCompare(b.worker_name),
  );
}

/** "Full day · +2h", "+3h (supplement only)", or "—" for an empty day. */
export function formatShiftSummary(
  t: LaborTranslate,
  shift: ShiftType | null | undefined,
  supplementHours: number | null | undefined,
): string {
  const hours = supplementHours ?? 0;
  const extra = hours > 0 ? `+${hours}h` : null;
  if (!shift) return extra ? `${extra} ${t("supplement.standaloneShiftLabel")}` : "—";
  const label = shift === "full" ? t("shiftFull") : shift === "half" ? t("shiftHalf") : t("shiftOvertime");
  return extra ? `${label} · ${extra}` : label;
}

/**
 * The day as it stands and as the worker wants it, each as one line. Applying
 * the change replaces the note too, so a proposal without a note says the
 * current one goes away.
 */
export function describeChangeRequest(
  t: LaborTranslate,
  request: AttendanceChangeRequest,
): { current: string; proposed: string } {
  const current = formatShiftSummary(t, request.shift_type, request.supplement_hours);
  const proposed = formatShiftSummary(t, request.proposed_shift_type, request.proposed_supplement_hours);
  const proposedNote = request.proposed_note
    ? ` — ${request.proposed_note}`
    : request.note
      ? ` — ${t("changeRequest.noteCleared")}`
      : "";
  return {
    current: request.note ? `${current} — ${request.note}` : current,
    proposed: `${proposed}${proposedNote}`,
  };
}
