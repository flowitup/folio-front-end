import { describe, it, expect } from "vitest";
import { projectSwitchPath } from "../project-switch-path";

describe("projectSwitchPath", () => {
  it("keeps the section of a project page", () => {
    expect(projectSwitchPath("/projects/a/planning", "b")).toBe("/projects/b/planning");
    expect(projectSwitchPath("/projects/a/labor/", "b")).toBe("/projects/b/labor");
  });

  it("drops the old project's entity ids, which would 404 under the new project", () => {
    expect(projectSwitchPath("/projects/a/analyses/an-1", "b")).toBe("/projects/b/analyses");
    expect(projectSwitchPath("/projects/a/invoices/inv-1", "b")).toBe("/projects/b/invoices");
    expect(projectSwitchPath("/projects/a/invoices/new", "b")).toBe("/projects/b/invoices");
  });

  it("returns null outside a project page", () => {
    expect(projectSwitchPath("/dashboard", "b")).toBeNull();
    expect(projectSwitchPath("/projects", "b")).toBeNull();
    expect(projectSwitchPath("/projects/a", "b")).toBeNull();
  });
});
