/**
 * Regression: an unknown path under a locale must reach the localized
 * not-found boundary (src/app/[locale]/not-found.tsx), not Next's default
 * unbranded English 404.
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

const { notFound } = await import("next/navigation");
const CatchAllNotFound = (await import("../[...rest]/page")).default;

describe("locale catch-all route", () => {
  it("calls notFound() so the localized 404 renders", () => {
    expect(() => CatchAllNotFound()).toThrow("NOT_FOUND");
    expect(vi.mocked(notFound)).toHaveBeenCalledTimes(1);
  });
});
