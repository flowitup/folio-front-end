/**
 * Unit tests for capitalizeFirst — pins the leading-char uppercase contract.
 *
 * Hardcodes input strings rather than relying on Intl.DateTimeFormat output,
 * which varies across Node versions / ICU bundles. Integration with
 * attendance-table is verified by the page test rendering the wrapped value.
 */

import { describe, it, expect } from "vitest";
import { capitalizeFirst } from "../capitalize-first";

describe("capitalizeFirst", () => {
  it("uppercases lowercase French weekday-led date strings", () => {
    // The exact string Intl.DateTimeFormat('fr-FR', { weekday:'long', ... })
    // produces in French.
    expect(capitalizeFirst("samedi 09/05/2026", "fr-FR")).toBe(
      "Samedi 09/05/2026",
    );
    expect(capitalizeFirst("lundi 01/01/2026", "fr-FR")).toBe(
      "Lundi 01/01/2026",
    );
  });

  it("is a no-op when the first char is already uppercase (English)", () => {
    expect(capitalizeFirst("Saturday, 5/9/2026", "en-US")).toBe(
      "Saturday, 5/9/2026",
    );
    expect(capitalizeFirst("Monday, 1/1/2026", "en-US")).toBe(
      "Monday, 1/1/2026",
    );
  });

  it("is a no-op when the first char is already uppercase (Vietnamese)", () => {
    // Vietnamese day names are typically capitalized by Intl.
    expect(capitalizeFirst("Thứ Bảy, 09/05/2026", "vi-VN")).toBe(
      "Thứ Bảy, 09/05/2026",
    );
  });

  it("returns empty string unchanged", () => {
    expect(capitalizeFirst("", "fr-FR")).toBe("");
  });

  it("leaves non-letter first chars unchanged", () => {
    expect(capitalizeFirst("9 mai 2026", "fr-FR")).toBe("9 mai 2026");
    expect(capitalizeFirst("— samedi", "fr-FR")).toBe("— samedi");
  });

  it("falls back to plain toUpperCase when no locale is provided", () => {
    expect(capitalizeFirst("samedi")).toBe("Samedi");
  });

  it("uses locale-aware uppercasing when a locale is given (Turkish dotted-i)", () => {
    // Sanity check that the locale arg is threaded through:
    // in tr-TR, toLocaleUpperCase('i') → 'İ' (with dot above).
    expect(capitalizeFirst("istanbul", "tr-TR").charAt(0)).toBe("İ");
  });
});
