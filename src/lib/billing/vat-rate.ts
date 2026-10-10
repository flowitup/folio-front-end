import { formatVatRate } from "@/lib/invoices/invoice-totals";

/**
 * A billing VAT rate as the API or the editor spells it ("5.50", "20") in the
 * app's language: "5,5 %" in French, "5.5%" in English, "5,5%" in Vietnamese.
 * Text that is not a number is shown as typed.
 */
export function formatBillingVatRate(rate: string, locale: string): string {
  const n = Number(rate);
  return rate.trim() !== "" && Number.isFinite(n) ? formatVatRate(n, locale) : rate;
}
