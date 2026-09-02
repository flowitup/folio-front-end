import type { HighlightColor } from "@/types/invoice";

/**
 * Fixed palette for the optional invoice/expense row-highlight color, shared by
 * the picker (swatch dots) and the list surfaces (row / card tint). Kept in sync
 * with the backend palette (schema Literal + CHECK constraint).
 *
 * - `swatch`: an opaque color for the picker dot (what the user clicks).
 * - `rowTint`: a subtle translucent background applied to the summary row / card
 *   so the tint reads in both light and dark themes without a per-theme table.
 */
export const HIGHLIGHT_COLORS: readonly HighlightColor[] = [
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
] as const;

interface HighlightSwatch {
  swatch: string;
  rowTint: string;
}

const HIGHLIGHT_STYLE: Record<HighlightColor, HighlightSwatch> = {
  red: { swatch: "#ef4444", rowTint: "rgba(239, 68, 68, 0.14)" },
  orange: { swatch: "#f97316", rowTint: "rgba(249, 115, 22, 0.14)" },
  yellow: { swatch: "#eab308", rowTint: "rgba(234, 179, 8, 0.16)" },
  green: { swatch: "#22c55e", rowTint: "rgba(34, 197, 94, 0.14)" },
  blue: { swatch: "#3b82f6", rowTint: "rgba(59, 130, 246, 0.14)" },
  purple: { swatch: "#a855f7", rowTint: "rgba(168, 85, 247, 0.14)" },
};

/** Opaque swatch color for the picker dot of a palette color. */
export function highlightSwatch(color: HighlightColor): string {
  return HIGHLIGHT_STYLE[color].swatch;
}

/**
 * Translucent background for tinting a list row / card, or `undefined` when the
 * value is null/absent or not a known palette color (defensive against legacy or
 * unexpected values from the API).
 */
export function highlightRowTint(color: HighlightColor | null | undefined): string | undefined {
  if (!color) return undefined;
  return HIGHLIGHT_STYLE[color]?.rowTint;
}
