/**
 * i18n parity for labor.monthClose ("Chốt tháng", QĐ-10): vi / fr / en carry
 * the same keys, none empty, and the placeholders each message needs.
 */

import { describe, it, expect } from "vitest";
import { createTranslator } from "next-intl";
import en from "../en.json";
import fr from "../fr.json";
import vi from "../vi.json";

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(tree)) {
    if (typeof v === "string") out[prefix + k] = v;
    else Object.assign(out, flatten(v, `${prefix}${k}.`));
  }
  return out;
}

const locales = {
  en: flatten(en.labor.monthClose as Tree),
  fr: flatten(fr.labor.monthClose as Tree),
  vi: flatten(vi.labor.monthClose as Tree),
};

describe("labor.monthClose i18n parity", () => {
  it("fr and vi have exactly the keys of en", () => {
    const enKeys = Object.keys(locales.en).sort();
    expect(Object.keys(locales.fr).sort()).toEqual(enKeys);
    expect(Object.keys(locales.vi).sort()).toEqual(enKeys);
  });

  it("no message is empty", () => {
    for (const [locale, messages] of Object.entries(locales)) {
      for (const [key, value] of Object.entries(messages)) {
        expect(value.trim(), `${locale}: ${key}`).not.toBe("");
      }
    }
  });

  it.each([
    ["closeButton", ["{month}"]],
    ["closedBadge", ["{month}"]],
    ["closedBy", ["{name}", "{date}"]],
    // "{count" also matches an ICU plural ("{count, plural, …}").
    ["editedAfterClose", ["{count", "{name}", "{time}"]],
    ["writeTitle", ["{months}"]],
    ["inClosedMonth", ["{month}"]],
  ])("%s keeps its placeholders in every locale", (key, placeholders) => {
    for (const [locale, messages] of Object.entries(locales)) {
      for (const p of placeholders) expect(messages[key], `${locale}: ${key}`).toContain(p);
    }
  });

  it("says '1 time' / '2 times' in English", () => {
    const t = createTranslator({ locale: "en", messages: en, namespace: "labor.monthClose" });
    expect(t("editedAfterClose", { count: 1, name: "Bob", time: "now" })).toBe(
      "Changed after closing: 1 time, last by Bob at now",
    );
    expect(t("closedStampEdited", { count: 2 })).toBe("Closed · changed 2 times");
  });

  it("speaks the owner's words in Vietnamese", () => {
    expect(locales.vi.closedBadge).toBe("Đã chốt tháng {month}");
    expect(locales.vi.writeTitle).toBe("Tháng {months} đã chốt. Vẫn lưu?");
  });
});
