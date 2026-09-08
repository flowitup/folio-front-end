import { describe, it, expect } from "vitest";
import { resolveDefaultRoleI18nKey, DEFAULT_ROLE_I18N_KEYS } from "../default-role-names";

describe("resolveDefaultRoleI18nKey", () => {
  it("resolves by slug when present", () => {
    expect(resolveDefaultRoleI18nKey({ slug: "tho_chinh" })).toBe("masterCraftsman");
    expect(resolveDefaultRoleI18nKey({ slug: "tho_phu" })).toBe("assistant");
  });

  it("resolves by the literal seed name when slug is absent", () => {
    expect(resolveDefaultRoleI18nKey({ name: "Thợ chính" })).toBe("masterCraftsman");
    expect(resolveDefaultRoleI18nKey({ name: "Thợ phụ" })).toBe("assistant");
  });

  it("falls back to the legacy fixed-UUID map", () => {
    const [legacyId] = Object.keys(DEFAULT_ROLE_I18N_KEYS);
    expect(resolveDefaultRoleI18nKey({ id: legacyId, name: "Custom Name" })).toBe(
      DEFAULT_ROLE_I18N_KEYS[legacyId]
    );
  });

  it("returns null for a user-created role (no slug/name/id match)", () => {
    expect(resolveDefaultRoleI18nKey({ id: "some-uuid", name: "Electrician" })).toBeNull();
  });

  it("returns null with no identifying fields at all", () => {
    expect(resolveDefaultRoleI18nKey({})).toBeNull();
  });
});
