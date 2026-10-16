import { describe, it, expect } from "vitest";
import { assigneeNamesWithFallback } from "../assignee-names";

describe("assigneeNamesWithFallback", () => {
  it("names a team member and gives anyone else the placeholder", () => {
    const names = assigneeNamesWithFallback(new Map([["u1", "Zoé"]]), "Outside the team");
    expect(names.get("u1")).toBe("Zoé");
    expect(names.get("u-admin")).toBe("Outside the team");
  });
});
