/**
 * The "Import members" button and toast read naturally for a count of zero in
 * every locale: the dialog opens with nobody selected, so vi used to show
 * "Nhập 0 thành viên" where en/fr show "Import" / "Importer".
 */

import { describe, it, expect } from "vitest";
import { createTranslator } from "next-intl";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import vi from "@/messages/vi.json";

const NS = "companySettings.import";

describe("companySettings.import plurals", () => {
  it.each([
    ["en", en, "Import"],
    ["fr", fr, "Importer"],
    ["vi", vi, "Nhập"],
  ] as const)("%s submit label with nobody selected has no count", (locale, messages, expected) => {
    const t = createTranslator({ locale, messages, namespace: NS });
    expect(t("submit", { count: 0 })).toBe(expected);
  });

  it("vi keeps the count once members are selected", () => {
    const t = createTranslator({ locale: "vi", messages: vi, namespace: NS });
    expect(t("submit", { count: 3 })).toBe("Nhập 3 thành viên");
    expect(t("importedToast", { count: 3 })).toBe("Đã nhập 3 thành viên");
  });

  it("vi toast for zero imported members does not say 'Đã nhập 0'", () => {
    const t = createTranslator({ locale: "vi", messages: vi, namespace: NS });
    expect(t("importedToast", { count: 0 })).toBe("Không có thành viên nào được nhập");
  });
});
