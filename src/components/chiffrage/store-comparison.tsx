"use client";

/**
 * What the whole run costs at each shop.
 *
 * The deliberate design constraint: a basket that skips the items a shop has
 * no price for makes the *least* complete shop look cheapest — price three of
 * twenty items and it "wins" at a fraction of the real cost. So shops that
 * cover everything are listed first and only they can be marked cheapest;
 * everything else sits below an explicit heading with its coverage and what it
 * is missing. Coverage is never rendered apart from the total.
 */

import { useTranslations } from "next-intl";
import { Store } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { money } from "@/components/chiffrage/format";
import type {
  ChiffrageStore,
  ChiffrageStoreBasket,
} from "@/lib/api/chiffrage";

interface Props {
  baskets: ChiffrageStoreBasket[];
  stores: ChiffrageStore[];
  /** Cheapest-per-item total — what a multi-shop run would cost. */
  bestMixHt: number;
  title: string;
  subtitle: string;
}

export function StoreComparison({
  baskets,
  stores,
  bestMixHt,
  title,
  subtitle,
}: Props) {
  const t = useTranslations("chiffrage");
  const byId = new Map(stores.map((s) => [s.id, s]));

  // Only baskets that price something are worth a row; a shop with nothing
  // recorded here is noise in this section's table.
  const rows = baskets.filter((b) => b.priced_article_count > 0);
  if (rows.length === 0) return null;

  const complete = rows.filter((b) => b.covers_all);
  const partial = rows.filter((b) => !b.covers_all);
  // Only a shop covering the whole scope can be called the cheapest.
  const cheapestId =
    complete.length > 0
      ? complete.reduce((a, b) => (b.basket_ht < a.basket_ht ? b : a)).store_id
      : null;

  const row = (basket: ChiffrageStoreBasket) => {
    const store = byId.get(basket.store_id);
    const premium = basket.basket_ht - bestMixHt;
    return (
      <tr
        key={basket.store_id}
        className="border-b last:border-0"
        data-testid="store-basket-row"
        data-covers-all={basket.covers_all ? "true" : "false"}
      >
        <td className="px-4 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{store?.name ?? t("unnamedSupplier")}</span>
            {basket.store_id === cheapestId ? (
              <Badge data-testid="cheapest-basket">{t("cheapestBasket")}</Badge>
            ) : null}
          </div>
        </td>
        <td className="px-4 py-2 text-right tabular-nums">
          <span className={basket.covers_all ? "" : "text-destructive"}>
            {t("coverageOf", {
              priced: basket.priced_article_count,
              total: basket.total_article_count,
            })}
          </span>
        </td>
        <td className="px-4 py-2 text-right font-medium tabular-nums">
          {money(basket.basket_ht)}
        </td>
        <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
          {money(basket.basket_ttc)}
        </td>
        <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
          {basket.covers_all
            ? premium <= 0
              ? "—"
              : `+${money(premium)}`
            : t("notComparable")}
        </td>
      </tr>
    );
  };

  return (
    <section className="rounded-lg border bg-card" data-testid="store-comparison">
      <header className="border-b px-4 py-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <Store className="h-4 w-4 text-muted-foreground" />
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm" data-testid="store-comparison-table">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2 font-medium">{t("shop")}</th>
              <th className="px-4 py-2 text-right font-medium">{t("coverage")}</th>
              <th className="px-4 py-2 text-right font-medium">{t("basketHt")}</th>
              <th className="px-4 py-2 text-right font-medium">{t("basketTtc")}</th>
              <th className="px-4 py-2 text-right font-medium">{t("vsBestMix")}</th>
            </tr>
          </thead>
          <tbody>
            {complete.map(row)}
            {partial.length > 0 ? (
              <>
                <tr className="border-b bg-muted/40">
                  <td
                    colSpan={5}
                    className="px-4 py-1.5 text-xs font-medium text-muted-foreground"
                    data-testid="partial-basket-heading"
                  >
                    {t("partialBasketsHeading")}
                  </td>
                </tr>
                {partial.map(row)}
              </>
            ) : null}
          </tbody>
        </table>
      </div>
      <footer className="border-t px-4 py-2 text-xs text-muted-foreground">
        {t("bestMixFooter", { total: money(bestMixHt) })}
      </footer>
    </section>
  );
}
