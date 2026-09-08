import { describe, it, expect } from "vitest";
import { shouldRedirectToOnboarding } from "../onboarding-gate";

describe("shouldRedirectToOnboarding", () => {
  it("redirects a user with zero companies and no visible projects", () => {
    expect(
      shouldRedirectToOnboarding({
        isPlatformOps: false,
        companiesCount: 0,
        hasVisibleProjects: false,
      })
    ).toBe(true);
  });

  it("does not redirect a user who has at least one company", () => {
    expect(
      shouldRedirectToOnboarding({
        isPlatformOps: false,
        companiesCount: 1,
        hasVisibleProjects: false,
      })
    ).toBe(false);
  });

  it("does not redirect a user with zero companies but a visible project", () => {
    expect(
      shouldRedirectToOnboarding({
        isPlatformOps: false,
        companiesCount: 0,
        hasVisibleProjects: true,
      })
    ).toBe(false);
  });

  it("never redirects platform ops, even with zero companies and no projects", () => {
    expect(
      shouldRedirectToOnboarding({
        isPlatformOps: true,
        companiesCount: 0,
        hasVisibleProjects: false,
      })
    ).toBe(false);
  });
});
