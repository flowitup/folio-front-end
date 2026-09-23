/**
 * Highlights every `@folio` token inside a chat message body — the same trigger the
 * backend watches for at send time (`(^|\s)@folio\b`, case-insensitive) to decide whether
 * to dispatch the message to the assistant. Matching the backend's own boundary (word start
 * or start-of-string before `@`, word boundary after `folio`) matters: a looser match
 * highlighted "contact@folio.fr" and "@folios" as if they triggered the assistant, when
 * neither one does. Purely cosmetic on the web: a simple split + `<mark>`-styled span, no
 * markdown parser or extra dependency.
 */

import type { ReactNode } from "react";

const MENTION_PATTERN = /(^|\s)(@folio)\b/gi;

/**
 * Splits `body` around `@folio` occurrences and wraps each in a highlighted span, leaving
 * the leading whitespace/start-of-string the trigger requires untouched. Returns the
 * original string as a single-element array when there is no mention, so callers can
 * render the result directly wherever they render plain text.
 */
export function highlightMention(body: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  // A fresh RegExp per call: a shared module-level global regex would carry `lastIndex`
  // state across calls and silently skip matches on the next invocation.
  const pattern = new RegExp(MENTION_PATTERN);
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body)) !== null) {
    const leading = match[1];
    const token = match[2];
    const mentionStart = match.index + leading.length;
    const mentionEnd = mentionStart + token.length;
    if (mentionStart > lastIndex) {
      nodes.push(<span key={key++}>{body.slice(lastIndex, mentionStart)}</span>);
    }
    nodes.push(
      <mark
        key={key++}
        className="rounded-[3px] px-0.5 font-medium not-italic"
        style={{ background: "var(--accent-soft, #fef3c7)", color: "inherit" }}
      >
        {token}
      </mark>
    );
    lastIndex = mentionEnd;
  }
  if (lastIndex < body.length || nodes.length === 0) {
    nodes.push(<span key={key++}>{body.slice(lastIndex)}</span>);
  }
  return nodes;
}
