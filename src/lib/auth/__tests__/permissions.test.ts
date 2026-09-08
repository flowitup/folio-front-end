import { describe, it, expect } from "vitest";
import { can, isPlatformOps, isCompanyAdmin, canCreateProject } from "../permissions";
import type { UserCompanySummary } from "../permissions";

describe("can", () => {
  it("grants when the project (membership) perms include the action, even if global lacks it", () => {
    expect(can("project:manage_labor", ["project:read", "user:read"], ["project:manage_labor"])).toBe(true);
  });

  it("grants on global *:* without project perms", () => {
    expect(can("project:manage_invoices", ["*:*"], undefined)).toBe(true);
  });

  it("grants on project-level *:* (membership admin role)", () => {
    expect(can("project:manage_labor", ["project:read"], ["*:*"])).toBe(true);
  });

  it("honors the resource wildcard project:*", () => {
    expect(can("project:manage_labor", [], ["project:*"])).toBe(true);
  });

  it("denies when neither global nor project perms grant it", () => {
    expect(can("project:manage_labor", ["project:read"], ["project:read"])).toBe(false);
  });

  it("denies safely with no perms at all", () => {
    expect(can("project:manage_labor", undefined, null)).toBe(false);
  });
});

describe("isPlatformOps", () => {
  it("true only for the *:* wildcard", () => {
    expect(isPlatformOps(["*:*"])).toBe(true);
    expect(isPlatformOps(["project:create"])).toBe(false);
    expect(isPlatformOps(undefined)).toBe(false);
    expect(isPlatformOps(null)).toBe(false);
  });
});

describe("isCompanyAdmin", () => {
  const companies: UserCompanySummary[] = [
    { id: "c1", legal_name: "Alpha", role: "admin", is_primary: true },
    { id: "c2", legal_name: "Beta", role: "manager", is_primary: false },
  ];

  it("true for admin of any company when no companyId given", () => {
    expect(isCompanyAdmin(companies)).toBe(true);
  });

  it("true for admin of the specific company", () => {
    expect(isCompanyAdmin(companies, "c1")).toBe(true);
  });

  it("false for a company where the caller is only manager/member", () => {
    expect(isCompanyAdmin(companies, "c2")).toBe(false);
  });

  it("false with no companies", () => {
    expect(isCompanyAdmin(undefined)).toBe(false);
    expect(isCompanyAdmin([])).toBe(false);
  });

  it("platform ops always passes regardless of companies", () => {
    expect(isCompanyAdmin([], "any-company", ["*:*"])).toBe(true);
  });
});

describe("canCreateProject", () => {
  it("false with only the legacy global project:create permission (ignored — no company-admin standing)", () => {
    expect(canCreateProject(["project:create"], [])).toBe(false);
  });

  it("true for the platform-ops wildcard", () => {
    expect(canCreateProject(["*:*"], [])).toBe(true);
  });

  it("true for a company admin without the legacy permission", () => {
    expect(
      canCreateProject([], [{ id: "c1", legal_name: "Alpha", role: "admin", is_primary: true }])
    ).toBe(true);
  });

  it("false for a manager/member with no legacy permission", () => {
    expect(
      canCreateProject([], [{ id: "c1", legal_name: "Alpha", role: "manager", is_primary: true }])
    ).toBe(false);
  });

  it("false with nothing at all", () => {
    expect(canCreateProject(undefined, undefined)).toBe(false);
  });
});
