/**
 * No fake site data: the sidebar used to show a hardcoded "22° / clear, Le
 * Lavandou · 4 workers on site" card to every user on every project, with no
 * data source behind it. It must not come back without one.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../../..");

describe("placeholder site weather", () => {
  it("is gone from the sidebar and the dashboard", () => {
    const sidebar = readFileSync(path.join(root, "components/layout/Sidebar.tsx"), "utf8");
    expect(sidebar).not.toMatch(/Lavandou|22°|\/ clear/);
    expect(existsSync(path.join(root, "components/dashboard/overview-weather-card.tsx"))).toBe(false);
  });
});
