/**
 * The guide must not describe controls the app does not have, nor contradict
 * the phone rule the forms apply (a leading 0 is accepted).
 */
import { describe, expect, it } from "vitest"

import { helpCatalogueEn } from "../en"
import { helpCatalogueFr } from "../fr"
import { helpCatalogueVi } from "../vi"

const TEXT = {
  en: JSON.stringify(helpCatalogueEn),
  fr: JSON.stringify(helpCatalogueFr),
  vi: JSON.stringify(helpCatalogueVi),
}

describe("help guide accuracy", () => {
  it("names no light/dark switch, which the top bar does not have", () => {
    expect(TEXT.en).not.toMatch(/light and dark|dark mode|theme/i)
    expect(TEXT.fr).not.toMatch(/thème clair|sombre/i)
    expect(TEXT.vi).not.toMatch(/sáng tối/i)
  })

  it("does not tell people to drop the leading 0 from their number", () => {
    expect(TEXT.en).not.toMatch(/without the leading zero/i)
    expect(TEXT.fr).not.toMatch(/sans le 0 initial/i)
    expect(TEXT.vi).not.toMatch(/bỏ số 0/i)
  })
})
