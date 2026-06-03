/**
 * Unit tests for src/lib/bibliotheque/categories.ts
 *
 * Tests:
 *   - LIBRARY_CATEGORY_SLUGS has 16 entries in canonical order
 *   - isLibraryCategorySlug: known slug → true, unknown → false
 *   - localizeCategory: slug → t("categories.<slug>"), null → t("uncategorized"),
 *     empty string → t("uncategorized"), unknown non-null → raw value
 */

import { describe, it, expect } from "vitest";
import {
  LIBRARY_CATEGORY_SLUGS,
  isLibraryCategorySlug,
  localizeCategory,
} from "../categories";

// Minimal fake translator: echoes the key so we can assert the exact key used.
const fakeT = (key: string) => `[${key}]`;

describe("LIBRARY_CATEGORY_SLUGS", () => {
  it("contains 16 slugs", () => {
    expect(LIBRARY_CATEGORY_SLUGS).toHaveLength(16);
  });

  it("starts with terrasse_jardin and ends with autre", () => {
    expect(LIBRARY_CATEGORY_SLUGS[0]).toBe("terrasse_jardin");
    expect(LIBRARY_CATEGORY_SLUGS[15]).toBe("autre");
  });

  it("contains all expected slugs", () => {
    const set = new Set(LIBRARY_CATEGORY_SLUGS);
    const expected = [
      "terrasse_jardin",
      "revetement_sol_mur_peinture",
      "chauffage_clim_ventilation",
      "salle_de_bains",
      "meuble_rangement",
      "cuisine",
      "luminaire",
      "decoration",
      "menuiserie",
      "materiaux_construction",
      "electricite_domotique",
      "outillage",
      "plomberie",
      "quincaillerie",
      "droguerie",
      "autre",
    ];
    for (const s of expected) {
      expect(set.has(s as never), `missing slug: ${s}`).toBe(true);
    }
  });
});

describe("isLibraryCategorySlug", () => {
  it("returns true for a known slug", () => {
    expect(isLibraryCategorySlug("cuisine")).toBe(true);
    expect(isLibraryCategorySlug("autre")).toBe(true);
  });

  it("returns false for an unknown string", () => {
    expect(isLibraryCategorySlug("Tools")).toBe(false);
    expect(isLibraryCategorySlug("")).toBe(false);
    expect(isLibraryCategorySlug("random_value")).toBe(false);
  });
});

describe("localizeCategory", () => {
  it("translates a known slug via categories.<slug> key", () => {
    // fakeT echoes the key; expected call is "categories.cuisine"
    expect(localizeCategory("cuisine", fakeT as never)).toBe("[categories.cuisine]");
    expect(localizeCategory("terrasse_jardin", fakeT as never)).toBe(
      "[categories.terrasse_jardin]"
    );
    expect(localizeCategory("autre", fakeT as never)).toBe("[categories.autre]");
  });

  it("returns t('uncategorized') for null", () => {
    expect(localizeCategory(null, fakeT as never)).toBe("[uncategorized]");
  });

  it("returns t('uncategorized') for undefined", () => {
    expect(localizeCategory(undefined, fakeT as never)).toBe("[uncategorized]");
  });

  it("returns t('uncategorized') for empty string", () => {
    expect(localizeCategory("", fakeT as never)).toBe("[uncategorized]");
  });

  it("returns raw value for unknown non-null string (defensive fallback)", () => {
    expect(localizeCategory("SomeLegacyCategory", fakeT as never)).toBe(
      "SomeLegacyCategory"
    );
    expect(localizeCategory("Outillage_old", fakeT as never)).toBe("Outillage_old");
  });
});
