import { describe, it, expect } from "vitest";
import {
  resolveDefaultRoleI18nKey,
  DEFAULT_ROLE_I18N_KEYS,
  laborRoleDisplayName,
  sortRolesByLabel,
} from "../default-role-names";

describe("resolveDefaultRoleI18nKey", () => {
  it("resolves by slug when present", () => {
    expect(resolveDefaultRoleI18nKey({ slug: "tho_chinh" })).toBe("masterCraftsman");
    expect(resolveDefaultRoleI18nKey({ slug: "tho_phu" })).toBe("assistant");
  });

  it("still resolves by slug when the stored name is the seed name", () => {
    expect(resolveDefaultRoleI18nKey({ slug: "tho_chinh", name: "Thợ chính" })).toBe(
      "masterCraftsman"
    );
    // Same name, decomposed — must not read as a rename.
    expect(
      resolveDefaultRoleI18nKey({ slug: "tho_phu", name: "Thợ phụ".normalize("NFD") })
    ).toBe("assistant");
  });

  it("shows a renamed seed role under its new name (the slug survives a rename)", () => {
    expect(resolveDefaultRoleI18nKey({ slug: "tho_chinh", name: "Chef d'équipe" })).toBeNull();
    expect(resolveDefaultRoleI18nKey({ name: "Chef d'équipe" })).toBeNull();
  });

  it("resolves by the literal seed name when slug is absent", () => {
    expect(resolveDefaultRoleI18nKey({ name: "Thợ chính" })).toBe("masterCraftsman");
    expect(resolveDefaultRoleI18nKey({ name: "Thợ phụ" })).toBe("assistant");
  });

  it("falls back to the legacy fixed-UUID map when no name is at hand", () => {
    const [legacyId] = Object.keys(DEFAULT_ROLE_I18N_KEYS);
    expect(resolveDefaultRoleI18nKey({ id: legacyId })).toBe(DEFAULT_ROLE_I18N_KEYS[legacyId]);
    expect(resolveDefaultRoleI18nKey({ id: legacyId, name: null })).toBe(
      DEFAULT_ROLE_I18N_KEYS[legacyId]
    );
  });

  it("shows a renamed legacy seed row under its new name", () => {
    const [legacyId] = Object.keys(DEFAULT_ROLE_I18N_KEYS);
    expect(resolveDefaultRoleI18nKey({ id: legacyId, name: "Custom Name" })).toBeNull();
  });

  it("returns null for a user-created role (no slug/name/id match)", () => {
    expect(resolveDefaultRoleI18nKey({ id: "some-uuid", name: "Electrician" })).toBeNull();
  });

  it("returns null with no identifying fields at all", () => {
    expect(resolveDefaultRoleI18nKey({})).toBeNull();
  });

  it("treats a default role seeded in French or English as not renamed", () => {
    expect(resolveDefaultRoleI18nKey({ slug: "tho_chinh", name: "Ouvrier principal" })).toBe(
      "masterCraftsman"
    );
    expect(resolveDefaultRoleI18nKey({ slug: "tho_phu", name: "Assistant worker" })).toBe(
      "assistant"
    );
    expect(resolveDefaultRoleI18nKey({ name: "ouvrier auxiliaire" })).toBe("assistant");
  });
});

describe("laborRoleDisplayName / sortRolesByLabel", () => {
  const fr = (key: string) =>
    ({ masterCraftsman: "Ouvrier principal", assistant: "Ouvrier auxiliaire" })[key] ?? key;

  it("shows default roles translated and custom roles as stored", () => {
    expect(laborRoleDisplayName({ slug: "tho_chinh", name: "Thợ chính" }, fr)).toBe(
      "Ouvrier principal"
    );
    expect(laborRoleDisplayName({ name: "Carreleur" }, fr)).toBe("Carreleur");
  });

  it("sorts by the label the viewer sees, not the stored Vietnamese name", () => {
    const roles = [
      { id: "1", name: "Thợ chính", slug: "tho_chinh" },
      { id: "2", name: "Thợ phụ", slug: "tho_phu" },
      { id: "3", name: "Carreleur" },
      { id: "4", name: "Plombier" },
    ];
    expect(sortRolesByLabel(roles, fr, "fr").map((r) => r.id)).toEqual(["3", "2", "1", "4"]);
  });
});
