/**
 * The workflow guide lives in typed modules rather than `src/messages/*.json`, so it sits
 * outside the message-parity tests. These assertions take their place: a locale cannot quietly
 * lose a topic, drop a step, or ship an empty field.
 */

import { describe, expect, it } from "vitest"

import { helpCatalogueEn } from "../en"
import { helpCatalogueFr } from "../fr"
import { helpCatalogueVi } from "../vi"
import type { HelpCatalogue } from "../types"

const TRANSLATIONS: [string, HelpCatalogue][] = [
  ["fr", helpCatalogueFr],
  ["vi", helpCatalogueVi],
]
const ALL: [string, HelpCatalogue][] = [["en", helpCatalogueEn], ...TRANSLATIONS]

describe("help catalogue", () => {
  it("documents at least one workflow", () => {
    expect(helpCatalogueEn.length).toBeGreaterThan(0)
  })

  it.each(ALL)("%s gives every topic a unique id", (_locale, catalogue) => {
    const ids = catalogue.map((topic) => topic.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it.each(TRANSLATIONS)(
    "%s covers the same topics in the same order as en",
    (_locale, catalogue) => {
      expect(catalogue.map((topic) => topic.id)).toEqual(
        helpCatalogueEn.map((topic) => topic.id)
      )
    }
  )

  it.each(TRANSLATIONS)(
    "%s keeps the same step and gotcha counts as en",
    (_locale, catalogue) => {
      const shape = (c: HelpCatalogue) =>
        c.map((topic) => ({
          id: topic.id,
          steps: topic.steps.length,
          gotchas: topic.gotchas?.length ?? 0,
        }))
      expect(shape(catalogue)).toEqual(shape(helpCatalogueEn))
    }
  )

  it.each(ALL)("%s repeats no line inside a topic", (_locale, catalogue) => {
    for (const topic of catalogue) {
      expect(new Set(topic.steps).size, `${topic.id} steps`).toBe(
        topic.steps.length
      )
      const gotchas = topic.gotchas ?? []
      expect(new Set(gotchas).size, `${topic.id} gotchas`).toBe(gotchas.length)
    }
  })

  it.each(TRANSLATIONS)(
    "%s was actually translated, not copied from en",
    (_locale, catalogue) => {
      const copied = catalogue
        .filter((topic, index) => {
          const english = helpCatalogueEn[index]
          return (
            topic.title === english.title &&
            topic.purpose === english.purpose &&
            topic.steps.join("\u0000") === english.steps.join("\u0000")
          )
        })
        .map((topic) => topic.id)
      expect(copied).toEqual([])
    }
  )

  it.each(ALL)("%s leaves no text blank", (_locale, catalogue) => {
    for (const topic of catalogue) {
      const texts = [
        topic.title,
        topic.purpose,
        topic.whoCanDoIt,
        ...topic.steps,
        ...(topic.gotchas ?? []),
      ]
      for (const text of texts) {
        expect(text.trim()).not.toBe("")
      }
    }
  })
})
