import type { BillingDocumentKind } from "@/types/billing";

/**
 * Maps `kind` to its URL path segment.
 * `devis` is the same singular/plural; `facture` becomes `factures` (plural).
 * The route directories on disk are `/billing/devis/...` and `/billing/factures/...`.
 */
export function kindToSegment(kind: BillingDocumentKind): "devis" | "factures" {
  return kind === "devis" ? "devis" : "factures";
}
