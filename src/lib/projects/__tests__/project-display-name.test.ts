import { describe, expect, it } from "vitest";
import {
  projectDisplayName,
  projectMatchesSearch,
  projectSecondaryLabel,
} from "../project-display-name";

describe("projectDisplayName", () => {
  it("shows the name first, even when the project has an address", () => {
    expect(projectDisplayName({ name: "Villa Ngoc", address: "12 rue de la Paix, Arcueil" })).toBe(
      "Villa Ngoc",
    );
  });

  it("falls back to the address when the name is blank", () => {
    expect(projectDisplayName({ name: "  ", address: " 12 rue de la Paix " })).toBe(
      "12 rue de la Paix",
    );
    expect(projectDisplayName({ name: "Villa Ngoc", address: null })).toBe("Villa Ngoc");
    expect(projectDisplayName({ name: "Villa Ngoc" })).toBe("Villa Ngoc");
  });
});

describe("projectSecondaryLabel", () => {
  it("is the address when it differs from the name", () => {
    expect(projectSecondaryLabel({ name: "Villa Ngoc", address: "12 rue de la Paix" })).toBe(
      "12 rue de la Paix",
    );
  });

  it("is null when there is no address or the name is the address", () => {
    expect(projectSecondaryLabel({ name: "Villa Ngoc", address: null })).toBeNull();
    expect(projectSecondaryLabel({ name: "12 rue X", address: " 12 rue X " })).toBeNull();
  });
});

describe("projectMatchesSearch", () => {
  const project = { name: "Villa Ngoc", address: "12 rue de la Paix" };

  it("matches the address or the name, case-insensitively", () => {
    expect(projectMatchesSearch(project, "PAIX")).toBe(true);
    expect(projectMatchesSearch(project, "ngoc")).toBe(true);
    expect(projectMatchesSearch(project, "lyon")).toBe(false);
  });

  it("ignores accents and the Vietnamese đ", () => {
    const vn = { name: "QA3 Villa", address: "45 Đường Lê Lợi, Quận 1" };
    expect(projectMatchesSearch(vn, "duong")).toBe(true);
    expect(projectMatchesSearch(vn, "le loi")).toBe(true);
    expect(projectMatchesSearch({ name: "QA3 Rénovation Lilas" }, "renovation")).toBe(true);
  });

  it("matches everything on an empty search", () => {
    expect(projectMatchesSearch({ name: "X", address: null }, "  ")).toBe(true);
  });
});
