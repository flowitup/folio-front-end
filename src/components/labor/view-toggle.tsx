"use client";

/**
 * ViewToggle — segmented control for switching between Calendar and
 * List views of the attendance tab (Phase 2d). Tiny, focused. State
 * lives in the parent (LaborPage).
 *
 * Plan: 260512-2341-labor-calendar-and-bulk-log → phase-02 (2d).
 */

import { CalendarDays, List } from "lucide-react";

import { cn } from "@/lib/utils";

export type AttendanceViewMode = "calendar" | "list";

interface ViewToggleProps {
  value: AttendanceViewMode;
  onChange: (next: AttendanceViewMode) => void;
}

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div
      role="tablist"
      aria-label="Attendance view"
      className="bg-muted/60 inline-flex items-center gap-1 rounded-md p-0.5"
    >
      {(
        [
          { id: "calendar" as const, label: "Calendar", Icon: CalendarDays },
          { id: "list" as const, label: "List", Icon: List },
        ]
      ).map(({ id, label, Icon }) => {
        const active = value === id;
        return (
          <button
            key={id}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
