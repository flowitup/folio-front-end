/**
 * Render a diffed quote note: the text verbatim, with the runs that are absent
 * from the other compared note(s) highlighted. Pairs with `diffQuoteNotes`.
 */

import type { NoteSegment } from "@/components/chiffrage/quote-note-diff";

/** Shared highlight style, also used by the legend so the swatch matches. */
export const NOTE_DIFF_MARK_CLASS =
  "rounded-sm bg-[var(--accent-tint)] px-0.5 text-[var(--accent-ink)]";

export function NoteDiffText({
  segments,
  className,
}: {
  segments: NoteSegment[];
  className?: string;
}) {
  return (
    <span className={className}>
      {segments.map((seg, i) =>
        seg.differs ? (
          <mark key={i} className={NOTE_DIFF_MARK_CLASS} data-testid="note-diff">
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </span>
  );
}
