/**
 * quote-note-diff.test.ts
 *
 * Two supplier notes describe two different products; the diff must surface
 * exactly the words that tell them apart (dimensions, motorisation, discount)
 * and stay quiet on everything they share. It also must not shout when there
 * is nothing to compare against — one note alone highlights nothing.
 */

import { describe, it, expect } from "vitest";

import {
  diffQuoteNotes,
  hasNoteDifferences,
  normalizeToken,
  type NoteSegment,
} from "../quote-note-diff";

const marked = (segments: NoteSegment[]) =>
  segments.filter((s) => s.differs).map((s) => s.text);
const rebuilt = (segments: NoteSegment[]) => segments.map((s) => s.text).join("");

const ALU =
  "Devis 63544 (ALU) – Coulissant 2 vantaux 1800×2200 (×2), VR monobloc Somfy radio – PU catalogue 2 941,17 € HT, remise 42 %";
const PVC =
  "Devis 63545 (PVC) – Coulissant 2 vantaux 1800×2200 (×2), VR monobloc Somfy filaire – PU catalogue 2 512,00 € HT, remise 35 %";

describe("normalizeToken", () => {
  it("drops case and wrapping punctuation but keeps the word", () => {
    expect(normalizeToken("(ALU),")).toBe("alu");
    expect(normalizeToken("(×2),")).toBe("×2");
    expect(normalizeToken("941,17")).toBe("941,17");
    expect(normalizeToken("–")).toBe("");
    expect(normalizeToken("42")).toBe("42");
  });
});

describe("diffQuoteNotes", () => {
  it("highlights only the words that differ between two notes", () => {
    const [a, b] = diffQuoteNotes([ALU, PVC]);
    expect(marked(a)).toEqual(["63544", "ALU", "radio", "941,17", "42"]);
    expect(marked(b)).toEqual(["63545", "PVC", "filaire", "512,00", "35"]);
  });

  it("rebuilds each note verbatim from its segments", () => {
    const [a, b] = diffQuoteNotes([ALU, PVC]);
    expect(rebuilt(a)).toBe(ALU);
    expect(rebuilt(b)).toBe(PVC);
  });

  it("marks nothing when the notes say the same thing", () => {
    const diff = diffQuoteNotes(["VR Somfy radio", "vr somfy RADIO."]);
    expect(hasNoteDifferences(diff)).toBe(false);
  });

  it("marks nothing when there is only one note to look at", () => {
    const diff = diffQuoteNotes([ALU, null]);
    expect(diff[0].every((s) => !s.differs)).toBe(true);
    expect(diff[1]).toEqual([]);
    expect(hasNoteDifferences(diff)).toBe(false);
    expect(hasNoteDifferences(diffQuoteNotes([ALU, ""]))).toBe(false);
  });

  it("merges adjacent differing words into one run, spaces included", () => {
    const [a] = diffQuoteNotes([
      "Fixe 940×900 + store extérieur motorisé",
      "Fixe 1200×900 + store intérieur manuel",
    ]);
    expect(marked(a)).toEqual(["940×900", "extérieur motorisé"]);
  });

  it("compares each note against every other one when there are three", () => {
    const [a, b, c] = diffQuoteNotes([
      "Somfy radio 42 %",
      "Somfy radio 35 %",
      "Somfy filaire 42 %",
    ]);
    // "42" is missing from b, "radio" from c → both marked on a, and since
    // they sit next to each other they merge into one run.
    expect(marked(a)).toEqual(["radio 42"]);
    expect(marked(b)).toEqual(["radio 35"]);
    expect(marked(c)).toEqual(["filaire 42"]);
  });
});
