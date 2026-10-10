/**
 * Text caps the billing API applies (back end: app/api/v1/billing/schemas.py).
 * A template's notes and terms share the document caps, so text a template
 * fills in always fits the document made from it.
 */

/** Notes and terms of a devis, facture or template. */
export const MAX_BILLING_NOTES = 2000;
/** Signature block of a devis or facture. */
export const MAX_SIGNATURE_BLOCK = 500;
/** Payment terms of a facture. */
export const MAX_PAYMENT_TERMS = 500;

export interface TextLimitCheck {
  /** Translated field label, shown in the error. */
  label: string;
  value: string;
  max: number;
}

/**
 * The first field whose text, as the form sends it (trimmed), is longer than
 * its cap, or null. Counts characters the way the API does (code points), so
 * an emoji counts once.
 */
export function firstTooLongField(checks: TextLimitCheck[]): TextLimitCheck | null {
  return checks.find((check) => [...check.value.trim()].length > check.max) ?? null;
}
