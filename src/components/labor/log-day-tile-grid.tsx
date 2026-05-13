"use client";

/**
 * LogDayTileGrid — section heading + grid of WorkerTiles wired to
 * the parent's tile-state map (Phase 3c).
 *
 * Extracted from LogDayDialog so the orchestrator stays under the
 * 200-LOC file budget. Pure presentational; all state lives in the
 * dialog.
 *
 * Plan: 260512-2341-labor-calendar-and-bulk-log → phase-03 (3c).
 */

import { WorkerTile } from "@/components/labor/worker-tile";
import { WorkerTileSection } from "@/components/labor/worker-tile-section";
import type { TileStateMap } from "@/components/labor/log-day-dialog-state";
import type { ConflictGroup, ShiftType, Worker } from "@/types/labor";

interface LogDayTileGridProps {
  heading: string;
  workers: Worker[];
  tileStates: TileStateMap;
  /** Phase 4: map of person_id → conflict group for the active date. */
  conflictsByPersonId?: Map<string, ConflictGroup>;
  showEmpty?: boolean;
  onToggle: (workerId: string, next: boolean) => void;
  onShiftChange: (workerId: string, shift: ShiftType) => void;
  onToggleExpanded: (workerId: string) => void;
  onAmountOverrideChange: (workerId: string, next: number | undefined) => void;
  onSupplementHoursChange: (workerId: string, next: number) => void;
  onNoteChange: (workerId: string, next: string) => void;
}

export function LogDayTileGrid({
  heading,
  workers,
  tileStates,
  conflictsByPersonId,
  showEmpty,
  onToggle,
  onShiftChange,
  onToggleExpanded,
  onAmountOverrideChange,
  onSupplementHoursChange,
  onNoteChange,
}: LogDayTileGridProps) {
  return (
    <WorkerTileSection
      heading={heading}
      countLabel={workers.length > 0 ? `${workers.length}` : undefined}
      showEmpty={showEmpty}
    >
      {workers.map((w) => {
        const s = tileStates[w.id];
        if (!s) return null;
        const conflict =
          conflictsByPersonId && w.person_id
            ? conflictsByPersonId.get(w.person_id)
            : undefined;
        return (
          <WorkerTile
            key={w.id}
            worker={w}
            checked={s.checked}
            shiftType={s.shift_type}
            locked={s.locked}
            expanded={s.expanded}
            amountOverride={s.amount_override}
            supplementHours={s.supplement_hours}
            note={s.note}
            conflict={conflict}
            onToggle={(next) => onToggle(w.id, next)}
            onShiftChange={(shift) => onShiftChange(w.id, shift)}
            onToggleExpanded={() => onToggleExpanded(w.id)}
            onAmountOverrideChange={(v) => onAmountOverrideChange(w.id, v)}
            onSupplementHoursChange={(v) => onSupplementHoursChange(w.id, v)}
            onNoteChange={(v) => onNoteChange(w.id, v)}
          />
        );
      })}
    </WorkerTileSection>
  );
}
