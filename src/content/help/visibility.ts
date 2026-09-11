import { can, isCompanyAdmin } from "@/lib/auth/permissions"
import type { UserCompanySummary } from "@/lib/auth/permissions"

import type { HelpCatalogue } from "./types"

/**
 * What the panel knows about the reader. The fields are exactly what the sidebar reads to decide
 * which entries to draw, so the guide and the navigation cannot disagree.
 */
export type HelpViewer = {
  permissions?: string[] | null
  companies?: UserCompanySummary[] | null
  /** The selected project's backend-resolved permissions. */
  projectPermissions?: string[] | null
}

const canSeeDocuments = (viewer: HelpViewer) =>
  can("project:update", viewer.permissions, viewer.projectPermissions)

const canSeeBilling = (viewer: HelpViewer) =>
  isCompanyAdmin(viewer.companies, null, viewer.permissions)

/**
 * A topic is listed only when its area is reachable for this reader — the guide shows what the
 * navigation shows, so nobody is walked through a screen they cannot open. An id absent from this
 * map is reachable by everyone who can sign in.
 *
 * Each gate mirrors a specific one in the nav: `documents` repeats `Sidebar`'s `canSeeDocuments`,
 * and the four billing topics repeat the billing group's company-admin check.
 */
const GATES: Record<string, (viewer: HelpViewer) => boolean> = {
  documents: canSeeDocuments,
  "billing-devis": canSeeBilling,
  "billing-factures": canSeeBilling,
  "billing-templates": canSeeBilling,
  "billing-refundable": canSeeBilling,
}

/** The catalogue narrowed to the areas this reader can actually reach. */
export function visibleHelpTopics(
  topics: HelpCatalogue,
  viewer: HelpViewer
): HelpCatalogue {
  return topics.filter((topic) => GATES[topic.id]?.(viewer) ?? true)
}

/** Ids that carry a gate — exported so a test can assert the map stays in step with the catalogue. */
export const GATED_TOPIC_IDS = Object.keys(GATES)
