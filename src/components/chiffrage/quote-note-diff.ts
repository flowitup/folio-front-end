/**
 * Token-level diff between supplier quote notes.
 *
 * Two shops rarely price the *same* thing: one quote is a 1800×2200 slider with
 * a radio-controlled shutter at 42 % off, the other a 940×900 fixed pane with a
 * motorised screen. The note is where that lives, as free text. Rather than
 * parse it, we compare word by word: a word is marked as differing when at
 * least one of the other notes does not contain it. Punctuation and case are
 * ignored so "(ALU)," matches "alu", and whitespace is kept verbatim so the
 * note renders exactly as typed, with the differing runs highlighted.
 *
 * With fewer than two non-empty notes there is nothing to compare, so nothing
 * is marked — a single note fully highlighted would just be noise.
 */

export interface NoteSegment {
  text: string;
  /** True when this run is absent from at least one other compared note. */
  differs: boolean;
}

/** Split on whitespace but keep the separators so the text can be rebuilt. */
const WHITESPACE = /(\s+)/;
/** Punctuation that wraps a word without being part of it: "(ALU)," → "ALU". */
const EDGE = "[\\s(),.;:!?\"'«»\\[\\]{}–—-]";
const WRAPPED = new RegExp(`^(${EDGE}*)(.*?)(${EDGE}*)$`, "u");

/** Split a token into its wrapping punctuation and the word inside. */
function unwrap(token: string): [string, string, string] {
  const m = WRAPPED.exec(token);
  return m ? [m[1], m[2], m[3]] : ["", token, ""];
}

/** Comparison key of a token: lowercase, edge punctuation stripped. */
export function normalizeToken(token: string): string {
  return unwrap(token)[1].toLowerCase();
}

function keysOf(text: string): Set<string> {
  return new Set(
    text
      .split(WHITESPACE)
      .map(normalizeToken)
      .filter((key) => key.length > 0),
  );
}

/**
 * Merge consecutive segments with the same flag, and absorb whitespace that
 * sits between two differing words so "1800×2200 (×2)" highlights as one run.
 */
function mergeRuns(segments: NoteSegment[]): NoteSegment[] {
  const flagged = segments.map((seg, i) => {
    if (seg.differs || seg.text.trim().length > 0) return seg;
    const prev = segments[i - 1];
    const next = segments[i + 1];
    return prev?.differs && next?.differs ? { ...seg, differs: true } : seg;
  });
  const merged: NoteSegment[] = [];
  for (const seg of flagged) {
    const last = merged[merged.length - 1];
    if (last && last.differs === seg.differs) last.text += seg.text;
    else merged.push({ ...seg });
  }
  return merged;
}

/**
 * Diff a list of notes against each other. The result is index-aligned with
 * the input; a null or empty note yields an empty segment list.
 */
export function diffQuoteNotes(
  notes: ReadonlyArray<string | null | undefined>,
): NoteSegment[][] {
  const texts = notes.map((n) => n ?? "");
  const keySets = texts.map(keysOf);
  const comparable = keySets.filter((s) => s.size > 0).length >= 2;

  return texts.map((text, i) => {
    if (text.length === 0) return [];
    const others = keySets.filter((set, j) => j !== i && set.size > 0);
    const segments: NoteSegment[] = [];
    for (const token of text.split(WHITESPACE)) {
      if (token.length === 0) continue;
      const [before, word, after] = unwrap(token);
      const key = word.toLowerCase();
      const differs =
        comparable && key.length > 0 && others.some((set) => !set.has(key));
      // Only the word is marked — its wrapping punctuation stays plain, so
      // "(ALU)," highlights as "ALU", not "(ALU),".
      if (before) segments.push({ text: before, differs: false });
      if (word) segments.push({ text: word, differs });
      if (after) segments.push({ text: after, differs: false });
    }
    return mergeRuns(segments);
  });
}

/** Whether any note in a diff result carries a highlighted run. */
export function hasNoteDifferences(diff: NoteSegment[][]): boolean {
  return diff.some((segments) => segments.some((s) => s.differs));
}
