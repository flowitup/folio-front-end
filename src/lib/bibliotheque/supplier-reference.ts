/**
 * A product created by hand without a reference gets a generated
 * "manual-5e7ea6ca3685" from the API, so it stays unique per supplier. That
 * placeholder is not something the user typed: it is never shown.
 */
export function displayedSupplierReference(reference: string | null | undefined): string | null {
  const text = reference?.trim();
  if (!text || text.startsWith("manual-")) return null;
  return text;
}
