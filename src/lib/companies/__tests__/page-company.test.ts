import { describe, it, expect } from "vitest";
import { pickPageCompany, projectCompanyLabel, toPageCompanies } from "../page-company";
import type { MyCompany } from "@/types/companies";

const company = (id: string, is_primary: boolean, attached_at: string, permissions?: string[]) =>
  ({ id, legal_name: id.toUpperCase(), is_primary, attached_at, role: "member", permissions }) as MyCompany;

describe("pickPageCompany", () => {
  const a = company("a", false, "2026-01-01T00:00:00Z");
  const b = company("b", false, "2026-02-01T00:00:00Z");
  const c = company("c", true, "2026-03-01T00:00:00Z");

  it("honours ?company= when it is one of the user's companies", () => {
    expect(pickPageCompany([a, b, c], "b")?.id).toBe("b");
  });

  it("ignores a ?company= the user does not belong to", () => {
    expect(pickPageCompany([a, b, c], "zzz")?.id).toBe("c");
  });

  it("defaults to the primary company", () => {
    expect(pickPageCompany([a, b, c])?.id).toBe("c");
  });

  it("without a primary, defaults to the oldest attachment (the API's order)", () => {
    expect(pickPageCompany([b, a])?.id).toBe("a");
  });

  it("keeps per-company permissions for gating", () => {
    expect(toPageCompanies([company("a", true, "2026-01-01T00:00:00Z", ["bibliotheque:read"])])).toEqual([
      { id: "a", legal_name: "A", is_primary: true, permissions: ["bibliotheque:read"] },
    ]);
  });
});

describe("projectCompanyLabel", () => {
  const cos = [
    { id: "a", legal_name: "Alpha" },
    { id: "b", legal_name: "Beta" },
  ];
  it("names the project's company only for users in several companies", () => {
    expect(projectCompanyLabel(cos, "b")).toBe("Beta");
    expect(projectCompanyLabel([cos[0]], "a")).toBeNull();
    expect(projectCompanyLabel(cos, null)).toBeNull();
    expect(projectCompanyLabel(cos, "zz")).toBeNull();
  });
});
