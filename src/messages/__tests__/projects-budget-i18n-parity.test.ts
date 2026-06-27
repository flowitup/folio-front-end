/**
 * i18n parity tests for project budget keys added in the budget feature.
 *
 * Asserts that en/fr/vi all carry identical key sets for the added budget keys,
 * and that each key is present and non-empty in every locale.
 */

import { describe, it, expect } from "vitest";
import en from "../en.json";
import fr from "../fr.json";
import vi from "../vi.json";

const BUDGET_KEYS = [
  "remaining",
  "overBudget",
  "budgetLabel",
  "budgetSourceLabel",
  "budgetSourceLabelOptional",
  "budgetSourcePlaceholder",
  "budgetInvalid",
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const enProjects = (en as any).projects as Record<string, unknown>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const frProjects = (fr as any).projects as Record<string, unknown>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const viProjects = (vi as any).projects as Record<string, unknown>;

describe("projects budget i18n parity — key presence and non-empty", () => {
  for (const key of BUDGET_KEYS) {
    it(`en.projects.${key} exists and is non-empty`, () => {
      const value = enProjects[key];
      expect(typeof value).toBe("string");
      expect((value as string).trim().length).toBeGreaterThan(0);
    });

    it(`fr.projects.${key} exists and is non-empty`, () => {
      const value = frProjects[key];
      expect(typeof value).toBe("string");
      expect((value as string).trim().length).toBeGreaterThan(0);
    });

    it(`vi.projects.${key} exists and is non-empty`, () => {
      const value = viProjects[key];
      expect(typeof value).toBe("string");
      expect((value as string).trim().length).toBeGreaterThan(0);
    });
  }
});

describe("projects budget i18n parity — key set symmetry", () => {
  it("fr has all the same budget keys as en", () => {
    for (const key of BUDGET_KEYS) {
      expect(frProjects[key], `missing fr key: projects.${key}`).toBeDefined();
    }
  });

  it("vi has all the same budget keys as en", () => {
    for (const key of BUDGET_KEYS) {
      expect(viProjects[key], `missing vi key: projects.${key}`).toBeDefined();
    }
  });
});

describe("projects budget i18n parity — locale values differ (not copy-paste)", () => {
  it("fr projects.remaining differs from en", () => {
    expect(frProjects["remaining"]).not.toBe(enProjects["remaining"]);
  });

  it("vi projects.remaining differs from en", () => {
    expect(viProjects["remaining"]).not.toBe(enProjects["remaining"]);
  });
});
