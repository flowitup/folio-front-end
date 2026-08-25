/**
 * Resolve the shop name to display for a price.
 *
 * The link is the source of truth: a price created with only `store_id` — which
 * the API accepts — carries no `supplier_name`, and reading the snapshot alone
 * would render it as an unnamed supplier. The snapshot is the fallback, kept so
 * a price whose shop was later deleted still says where it came from.
 */

import type { ChiffrageQuote, ChiffrageStore } from "@/lib/api/chiffrage";

export function shopNameFor(
  quote: Pick<ChiffrageQuote, "store_id" | "supplier_name"> | undefined,
  stores: ChiffrageStore[],
): string | null {
  if (!quote) return null;
  const linked = quote.store_id
    ? stores.find((s) => s.id === quote.store_id)
    : undefined;
  return linked?.name ?? quote.supplier_name ?? null;
}
