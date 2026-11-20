/**
 * A facture converted from a devis keeps the devis' notes and terms, which
 * often still say "Devis valable 30 jours". Sending that on an invoice reads
 * badly, so the form and the "mark as sent" dialog warn about it (they never
 * block, and the text is never changed for the user).
 */

import type { BillingDocument } from "@/types/billing";

const DEVIS_TERMS_RE = /devis\s+valable|validité\s+du\s+devis/i;

/** True when the text reads like a quote's validity clause. */
export function looksCopiedFromDevis(text: string | null | undefined): boolean {
  return !!text && DEVIS_TERMS_RE.test(text);
}

/** True when a facture's notes or terms read like a quote's validity clause. */
export function factureHasDevisTerms(
  doc: Pick<BillingDocument, "kind" | "notes" | "terms">,
): boolean {
  return doc.kind === "facture" && (looksCopiedFromDevis(doc.notes) || looksCopiedFromDevis(doc.terms));
}
