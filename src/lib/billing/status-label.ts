/**
 * Readable label for a billing document's status, never a raw message key.
 *
 * A status the kind does not normally have (a devis imported as "paid" by an
 * older API client) used to render "BILLING.DEVIS.STATUS.PAID". The label now
 * falls back to the other kind's wording, then to a neutral "unknown status".
 *
 * `t` is the translator of the "billing" namespace.
 */
export interface BillingTranslator {
  (key: string): string;
  has(key: string): boolean;
}

export function billingStatusLabel(t: BillingTranslator, kind: string, status: string): string {
  const own = `${kind}.status.${status}`;
  if (t.has(own)) return t(own);
  const other = `${kind === "devis" ? "facture" : "devis"}.status.${status}`;
  if (t.has(other)) return t(other);
  return t("unknownStatus");
}
