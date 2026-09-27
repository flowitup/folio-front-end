/**
 * Labor-role editor helpers: what a failed mutation says, and which fields an
 * edit actually sends.
 */

import { describe, it, expect } from "vitest";
import enMessages from "@/messages/en.json";
import { buildLaborRoleUpdate, laborRoleErrorMessage } from "../labor-role-helpers";
import type { LaborRole } from "@/types/labor-role";

const role = enMessages.labor.role;

/** Minimal `labor.role` translator over the real English copy. */
function t(key: string): string {
  const value = key
    .split(".")
    .reduce<unknown>((acc, k) => (acc as Record<string, unknown>)?.[k], role);
  return typeof value === "string" ? value : key;
}

const SEEDED: LaborRole = {
  id: "r1",
  name: "Thợ chính",
  color: "#E11D48",
  created_at: "2026-01-01T00:00:00Z",
  slug: "tho_chinh",
};

describe("laborRoleErrorMessage", () => {
  it("translates the codes the backend can answer with", () => {
    expect(laborRoleErrorMessage(t, { error: "duplicate" }, "update")).toBe(role.duplicateName);
    expect(laborRoleErrorMessage(t, { error: "forbidden" }, "delete")).toBe(role.errors.forbidden);
    expect(laborRoleErrorMessage(t, { error: "notFound" }, "update")).toBe(role.errors.notFound);
    expect(laborRoleErrorMessage(t, { error: "rateLimited" }, "create")).toBe(
      role.errors.rateLimited
    );
    expect(
      laborRoleErrorMessage(t, { error: "validation", message: "Invalid input: name" }, "update")
    ).toBe(role.errors.invalid);
  });

  it("keeps the backend's own words for anything else", () => {
    expect(
      laborRoleErrorMessage(t, { error: "generic", message: "Role is still used" }, "delete")
    ).toBe(`${role.deleteFailed}: Role is still used`);
    expect(laborRoleErrorMessage(t, { error: "generic" }, "update")).toBe(role.updateFailed);
  });

  it("never calls a refused delete a duplicate name or a bad field", () => {
    expect(
      laborRoleErrorMessage(t, { error: "duplicate", message: "Role is in use" }, "delete")
    ).toBe(`${role.deleteFailed}: Role is in use`);
    expect(
      laborRoleErrorMessage(t, { error: "validation", message: "Role is in use" }, "delete")
    ).toBe(`${role.deleteFailed}: Role is in use`);
  });
});

describe("buildLaborRoleUpdate", () => {
  it("sends only the color when the shown (translated) name was left alone", () => {
    expect(
      buildLaborRoleUpdate(SEEDED, "Master craftsman", { name: "Master craftsman", color: "#0EA5E9" })
    ).toEqual({ color: "#0EA5E9" });
  });

  it("sends the new name, trimmed, when it was changed", () => {
    expect(
      buildLaborRoleUpdate(SEEDED, "Master craftsman", { name: "  Chef d'équipe ", color: "#E11D48" })
    ).toEqual({ name: "Chef d'équipe" });
  });

  it("ignores a color that only differs in case", () => {
    expect(
      buildLaborRoleUpdate(SEEDED, "Master craftsman", { name: "Master craftsman", color: "#e11d48" })
    ).toBeNull();
  });

  it("returns null when nothing changed", () => {
    expect(
      buildLaborRoleUpdate(SEEDED, "Master craftsman", { name: "Master craftsman", color: "#E11D48" })
    ).toBeNull();
  });
});
