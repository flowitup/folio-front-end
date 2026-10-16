import { describe, expect, it } from "vitest";
import { foldForSearch, searchIncludes } from "../fold-for-search";

describe("foldForSearch", () => {
  it("removes accents, maps đ to d and lower-cases", () => {
    expect(foldForSearch("Đường Lê Lợi")).toBe("duong le loi");
    expect(foldForSearch("Éloïse")).toBe("eloise");
    expect(foldForSearch("Quyết định")).toBe("quyet dinh");
    expect(foldForSearch("Rénovation")).toBe("renovation");
  });
});

describe("searchIncludes", () => {
  it("matches without the accents on either side", () => {
    expect(searchIncludes("QA3 45 Đường Lê Lợi, Quận 1", "le loi")).toBe(true);
    expect(searchIncludes("Livraison: Éloïse", "eloise")).toBe(true);
    expect(searchIncludes("Livraison: Eloise", "éloïse")).toBe(true);
    expect(searchIncludes("abc", "xyz")).toBe(false);
    expect(searchIncludes(null, "  ")).toBe(true);
  });
});
