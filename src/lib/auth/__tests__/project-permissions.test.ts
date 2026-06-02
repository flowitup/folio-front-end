import { describe, it, expect } from "vitest";
import { canOnProject } from "../project-permissions";

describe("canOnProject", () => {
  it("grants when the project (membership) perms include the action, even if global lacks it", () => {
    // Invited project-manager: global role is read-only, membership grants manage_labor.
    expect(canOnProject("project:manage_labor", ["project:read", "user:read"], ["project:manage_labor"])).toBe(true);
  });

  it("grants on global *:* without project perms", () => {
    expect(canOnProject("project:manage_invoices", ["*:*"], undefined)).toBe(true);
  });

  it("grants on project-level *:* (membership admin role)", () => {
    expect(canOnProject("project:manage_labor", ["project:read"], ["*:*"])).toBe(true);
  });

  it("honors the resource wildcard project:*", () => {
    expect(canOnProject("project:manage_labor", [], ["project:*"])).toBe(true);
  });

  it("denies when neither global nor project perms grant it", () => {
    expect(canOnProject("project:manage_labor", ["project:read"], ["project:read"])).toBe(false);
  });

  it("denies safely with no perms at all", () => {
    expect(canOnProject("project:manage_labor", undefined, null)).toBe(false);
  });
});
