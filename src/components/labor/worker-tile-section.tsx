"use client";

/**
 * WorkerTileSection — heading + responsive tile grid (Phase 3b).
 *
 * Pure layout: 2 cols on mobile, 3 cols on desktop (≥ sm breakpoint).
 * Heading is optional; LogDayDialog uses it to split between
 * "Recent (last 7 days)" and "All workers".
 *
 * Renders an empty-state line when there are no children — typically
 * because the search query filtered everything out.
 *
 * Plan: 260512-2341-labor-calendar-and-bulk-log → phase-03 (3b).
 */

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface WorkerTileSectionProps {
  /** Optional heading rendered above the grid. */
  heading?: string;
  /** Optional muted right-aligned count badge next to the heading. */
  countLabel?: string;
  /** Tiles (WorkerTile elements). */
  children: ReactNode;
  /** Renders an empty-state row when no children. Defaults to true. */
  showEmpty?: boolean;
  className?: string;
}

export function WorkerTileSection({
  heading,
  countLabel,
  children,
  showEmpty = true,
  className,
}: WorkerTileSectionProps) {
  const tileCount = Array.isArray(children) ? children.length : children ? 1 : 0;
  const empty = tileCount === 0;

  return (
    <div className={cn("space-y-2", className)}>
      {heading && (
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
            {heading}
          </h3>
          {countLabel && (
            <span className="text-muted-foreground text-[10px] font-mono">
              {countLabel}
            </span>
          )}
        </div>
      )}

      {empty && showEmpty ? (
        <p className="text-muted-foreground text-sm italic">No workers.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{children}</div>
      )}
    </div>
  );
}
