"use client";

/**
 * What the whole section costs at each shop, one card per shop, across the
 * top of the compare dialog.
 *
 * Same guard as the shop table on the chiffrage page: a basket that skips the
 * items a shop has no price for makes the *least* complete shop look cheapest,
 * so only a shop covering every item can be called the cheapest. Shops that
 * cover everything come first; the rest carry their coverage and read "not
 * comparable on price" instead of a comparison.
 */

import { useTranslations } from "next-intl";

import { money } from "@/components/chiffrage/format";
import { lineCents } from "@/components/chiffrage/compare-lines";
import type { ChiffrageStore, ChiffrageStoreBasket } from "@/lib/api/chiffrage";

interface Props {
  baskets: ChiffrageStoreBasket[];
  stores: ChiffrageStore[];
  /** Cheapest-per-item total — what a multi-shop run would cost. */
  bestMixHt: number;
}

const CHIP_BASE =
  "label-cap inline-block rounded-full px-2 py-0.5 leading-4 whitespace-nowrap";
const CHIP_POSITIVE =
  "bg-[var(--positive-tint)] text-[var(--positive)]";
const CHIP_ACCENT = "bg-[var(--accent-tint)] text-[var(--accent-ink)]";
const CHIP_NEUTRAL = "bg-secondary text-muted-foreground";

export function CompareBasketStrip({ baskets, stores, bestMixHt }: Props) {
  const t = useTranslations("chiffrage");
  const byId = new Map(stores.map((s) => [s.id, s]));

  // A shop with nothing priced here is noise; it still shows in the pickers.
  const priced = baskets.filter((b) => b.priced_article_count > 0);
  if (priced.length === 0) return null;

  const complete = priced
    .filter((b) => b.covers_all)
    .sort((a, b) => a.basket_ht - b.basket_ht);
  const partial = priced
    .filter((b) => !b.covers_all)
    .sort((a, b) => b.priced_article_count - a.priced_article_count);
  // "Le moins cher" only when strictly cheaper than the next complete basket;
  // complete baskets at the same price to the cent are an "égalité".
  const cents = (basket: ChiffrageStoreBasket) => lineCents(basket.basket_ht);
  const cheapestId =
    complete.length === 1 || (complete.length >= 2 && cents(complete[0]) < cents(complete[1]))
      ? complete[0].store_id
      : null;
  const tiedIds = new Set(
    complete.length >= 2 && cents(complete[0]) === cents(complete[1])
      ? complete.filter((b) => cents(b) === cents(complete[0])).map((b) => b.store_id)
      : []
  );

  const chip = (basket: ChiffrageStoreBasket) => {
    if (basket.store_id === cheapestId)
      return (
        <span className={`${CHIP_BASE} ${CHIP_POSITIVE}`} data-testid="cheapest-basket">
          {t("cheapestBasket")}
        </span>
      );
    if (tiedIds.has(basket.store_id))
      return (
        <span className={`${CHIP_BASE} ${CHIP_POSITIVE}`} data-testid="tied-basket">
          {t("compareTieBasket")}
        </span>
      );
    if (basket.covers_all)
      return (
        <span className={`${CHIP_BASE} ${CHIP_NEUTRAL}`}>{t("compareFullBasket")}</span>
      );
    return (
      <span className={`${CHIP_BASE} ${CHIP_ACCENT}`}>
        {t("comparePricedOf", {
          priced: basket.priced_article_count,
          total: basket.total_article_count,
        })}
      </span>
    );
  };

  const subline = (basket: ChiffrageStoreBasket) => {
    if (!basket.covers_all)
      return t("compareMissingItems", {
        count: basket.total_article_count - basket.priced_article_count,
      });
    const premiumCents = lineCents(basket.basket_ht) - lineCents(bestMixHt);
    const premium = premiumCents / 100;
    return premiumCents > 0
      ? t("compareVsBestMix", { amount: `+${money(premium)}` })
      : t("compareEqualsBestMix");
  };

  return (
    <div
      className="grid gap-px border-b bg-border sm:grid-cols-2 lg:grid-cols-3"
      data-testid="compare-basket-strip"
    >
      {[...complete, ...partial].map((basket) => (
        <div
          key={basket.store_id}
          className="bg-background px-6 py-4"
          data-testid="compare-basket-card"
          data-covers-all={basket.covers_all ? "true" : "false"}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">
              {byId.get(basket.store_id)?.name ?? t("unnamedSupplier")}
            </span>
            {chip(basket)}
          </div>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="num text-xl font-semibold tabular-nums">
              {money(basket.basket_ht)}
            </span>
            <span className="text-xs text-muted-foreground">{t("compareExclTax")}</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{subline(basket)}</p>
        </div>
      ))}
    </div>
  );
}
