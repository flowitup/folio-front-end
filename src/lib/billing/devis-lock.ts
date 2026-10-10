import type { BillingDocument } from "@/types/billing";

/**
 * A devis converted to a facture stays as it is (no edit, no status change)
 * until that facture is cancelled: the API answers 409 devis_locked_by_facture
 * otherwise. A facture is never locked this way.
 */
export function isDevisLockedByFacture(
  doc: Pick<BillingDocument, "kind" | "converted_to_facture_id" | "converted_facture_status">
): boolean {
  return (
    doc.kind === "devis" &&
    Boolean(doc.converted_to_facture_id) &&
    doc.converted_facture_status !== "cancelled"
  );
}
