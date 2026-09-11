/**
 * The guide lists what the reader's own navigation lists. These assertions pin that rule, and —
 * more importantly — pin the gate map to the catalogue: a renamed or removed topic id would
 * otherwise leave a dead gate behind and silently expose the area it was meant to hide.
 */

import { describe, expect, it } from "vitest"

import { helpCatalogueEn } from "../en"
import { GATED_TOPIC_IDS, visibleHelpTopics, type HelpViewer } from "../visibility"

const ADMIN: HelpViewer = {
  permissions: [],
  companies: [{ id: "c1", role: "admin" } as never],
  projectPermissions: ["project:update"],
}
const MEMBER: HelpViewer = {
  permissions: [],
  companies: [{ id: "c1", role: "member" } as never],
  projectPermissions: ["project:read"],
}

const idsFor = (viewer: HelpViewer) =>
  visibleHelpTopics(helpCatalogueEn, viewer).map((topic) => topic.id)

describe("help visibility", () => {
  it("gates only ids that exist in the catalogue", () => {
    const known = new Set(helpCatalogueEn.map((topic) => topic.id))
    const stale = GATED_TOPIC_IDS.filter((id) => !known.has(id))
    expect(stale).toEqual([])
  })

  it("shows a company admin with project rights the whole catalogue", () => {
    expect(idsFor(ADMIN)).toEqual(helpCatalogueEn.map((topic) => topic.id))
  })

  it("hides documents from a reader without project-editing rights", () => {
    expect(idsFor(MEMBER)).not.toContain("documents")
    expect(idsFor(ADMIN)).toContain("documents")
  })

  it("hides every billing topic from a reader who is not a company admin", () => {
    const member = idsFor(MEMBER)
    for (const id of [
      "billing-devis",
      "billing-factures",
      "billing-templates",
      "billing-refundable",
    ]) {
      expect(member, id).not.toContain(id)
      expect(idsFor(ADMIN), id).toContain(id)
    }
  })

  it("still offers a plain member the areas they can reach", () => {
    const member = idsFor(MEMBER)
    for (const id of ["getting-started", "planning", "notes", "notifications"]) {
      expect(member, id).toContain(id)
    }
    expect(member.length).toBeGreaterThan(helpCatalogueEn.length / 2)
  })
})
