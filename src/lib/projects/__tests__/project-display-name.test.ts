import { describe, expect, it } from "vitest";
import { projectDisplayName, projectMatchesSearch } from "../project-display-name";

describe("projectDisplayName", () => {
  it("shows the address when the project has one", () => {
    expect(projectDisplayName({ name: "Villa Ngoc", address: "12 rue de la Paix, Arcueil" })).toBe(
      "12 rue de la Paix, Arcueil",
    );
  });

  it("falls back to the name when the address is missing or blank", () => {
    expect(projectDisplayName({ name: "Villa Ngoc", address: null })).toBe("Villa Ngoc");
    expect(projectDisplayName({ name: "Villa Ngoc", address: "   " })).toBe("Villa Ngoc");
    expect(projectDisplayName({ name: "Villa Ngoc" })).toBe("Villa Ngoc");
  });
});

describe("projectMatchesSearch", () => {
  const project = { name: "Villa Ngoc", address: "12 rue de la Paix" };

  it("matches the address or the name, case-insensitively", () => {
    expect(projectMatchesSearch(project, "PAIX")).toBe(true);
    expect(projectMatchesSearch(project, "ngoc")).toBe(true);
    expect(projectMatchesSearch(project, "lyon")).toBe(false);
  });

  it("matches everything on an empty search", () => {
    expect(projectMatchesSearch({ name: "X", address: null }, "  ")).toBe(true);
  });
});
