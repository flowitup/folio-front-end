import { describe, it, expect } from "vitest";
import { isWithoutWorkspace, shouldRedirectToOnboarding } from "../onboarding-gate";

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

describe("isWithoutWorkspace", () => {
  it("is true for a user with no company and no visible project", () => {
    expect(isWithoutWorkspace({ permissions: [], companies: [] }, 0)).toBe(true);
  });

  it("is false with a company, a visible project, for platform ops, or before the user is known", () => {
    expect(isWithoutWorkspace({ permissions: [], companies: [{}] }, 0)).toBe(false);
    expect(isWithoutWorkspace({ permissions: [], companies: [] }, 1)).toBe(false);
    expect(isWithoutWorkspace({ permissions: ["*:*"], companies: [] }, 0)).toBe(false);
    expect(isWithoutWorkspace(null, 0)).toBe(false);
  });
});
