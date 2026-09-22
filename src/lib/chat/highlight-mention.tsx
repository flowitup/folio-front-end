/**
 * Highlights every `@folio` token inside a chat message body — the same trigger the
 * backend watches for at send time (`(^|\s)@folio\b`, case-insensitive) to decide whether
 * to dispatch the message to the assistant. Purely cosmetic on the web: a simple
 * split + `<mark>`-styled span, no markdown parser or extra dependency.
 */

import type { ReactNode } from "react";

const MENTION_SPLIT = /(@folio)/gi;
const MENTION_MATCH = /^@folio$/i;

/**
 * Splits `body` around `@folio` occurrences and wraps each in a highlighted span.
 * Returns the original string as a single-element array when there is no mention,
 * so callers can render the result directly wherever they render plain text.
 */
export function highlightMention(body: string): ReactNode[] {
  const parts = body.split(MENTION_SPLIT);
  return parts.map((part, index) =>
    MENTION_MATCH.test(part) ? (
      <mark
        key={index}
        className="rounded-[3px] px-0.5 font-medium not-italic"
        style={{ background: "var(--accent-soft, #fef3c7)", color: "inherit" }}
      >
        {part}
      </mark>
    ) : (
      <span key={index}>{part}</span>
    )
  );
}
