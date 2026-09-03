"use client";

/**
 * Head-to-head shop comparison for one section, opened from its Compare button.
 *
 * The top gives the all-shops basket overview (coverage and best mix); below
 * it, two shops are picked and every item in the section is laid out side by
 * side so the cheaper source per line is obvious. Prices come straight from the
 * recorded quotes — a shop with no quote for an item shows a dash, never a
 * zero, so a gap never reads as free. The pickers list every project shop, so
 * you can line up a shop that prices nothing here (it simply shows dashes).
 */

import { useId, useState } from "react";
import { useTranslations } from "next-intl";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { money, quantity } from "@/components/chiffrage/format";
import { StoreComparison } from "@/components/chiffrage/store-comparison";
import type {
  ChiffrageArticle,
  ChiffragePoste,
  ChiffrageStore,
} from "@/lib/api/chiffrage";

interface Props {
  open: boolean;
  poste: ChiffragePoste;
  /** Every project shop — you may compare one that prices nothing here. */
  stores: ChiffrageStore[];
  onOpenChange: (open: boolean) => void;
}

/** Cheapest recorded price for an article at a shop, or null if none. */
function priceAt(
  article: ChiffrageArticle,
  storeId: string | null,
): { ht: number; ttc: number } | null {
  if (!storeId) return null;
  const quotes = article.quotes.filter((q) => q.store_id === storeId);
  if (quotes.length === 0) return null;
  const cheapest = quotes.reduce((a, b) =>
    b.unit_price_ht < a.unit_price_ht ? b : a,
  );
  return { ht: cheapest.unit_price_ht, ttc: cheapest.unit_price_ttc };
}

/** The two best-covering shops, used as the default pair to compare. */
function defaultPair(poste: ChiffragePoste): [string | null, string | null] {
  const ranked = [...poste.store_baskets]
    .filter((b) => b.priced_article_count > 0)
    .sort(
      (a, b) =>
        Number(b.covers_all) - Number(a.covers_all) ||
        b.priced_article_count - a.priced_article_count ||
        a.basket_ht - b.basket_ht,
    );
  return [ranked[0]?.store_id ?? null, ranked[1]?.store_id ?? null];
}

export function SectionCompareDialog({
  open,
  poste,
  stores,
  onOpenChange,
}: Props) {
  const t = useTranslations("chiffrage");
  const [initialA, initialB] = defaultPair(poste);
  const [shopA, setShopA] = useState<string | null>(initialA);
  const [shopB, setShopB] = useState<string | null>(initialB);
  const shopAId = useId();
  const shopBId = useId();

  const byId = new Map(stores.map((s) => [s.id, s]));
  const articles = [...poste.articles].sort((a, b) => a.position - b.position);

  // The per-shop section basket comes straight from the server-built baskets
  // already shown in the summary above, so the footer total can never disagree
  // with it (both cost each item at the shop's cheapest quote). A shop that
  // prices nothing here has priced_article_count 0 — rendered as a dash, not
  // "0,00 €", so an empty basket never reads as free.
  const basketFor = (storeId: string | null) =>
    storeId
      ? (poste.store_baskets.find((b) => b.store_id === storeId) ?? null)
      : null;

  const picker = (
    id: string,
    value: string | null,
    onChange: (v: string) => void,
    label: string,
  ) => (
    <div className="min-w-0 flex-1 text-sm">
      {/* A Radix Select trigger is a combobox button, not a form control, so it
          is named with aria-labelledby rather than wrapped in a <label> (which
          would forward its click and double-toggle the popover). */}
      <span
        id={id}
        className="mb-1 block text-xs font-medium text-muted-foreground"
      >
        {label}
      </span>
      <Select value={value ?? undefined} onValueChange={onChange}>
        <SelectTrigger className="w-full" aria-labelledby={id}>
          <SelectValue placeholder={t("comparePickShop")} />
        </SelectTrigger>
        <SelectContent>
          {stores.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const priceCell = (
    p: { ht: number; ttc: number } | null,
    cheaper: boolean,
  ) => {
    if (!p) return <span className="text-muted-foreground">—</span>;
    return (
      <span className={cheaper ? "font-semibold text-primary" : undefined}>
        <span className="block tabular-nums">{money(p.ht)}</span>
        <span className="block text-xs text-muted-foreground tabular-nums">
          {money(p.ttc)}
        </span>
      </span>
    );
  };

  const basketCell = (
    b: { basket_ht: number; basket_ttc: number; priced_article_count: number } | null,
  ) => {
    if (!b || b.priced_article_count === 0)
      return <span className="text-muted-foreground">—</span>;
    return (
      <span>
        <span className="block tabular-nums">{money(b.basket_ht)}</span>
        <span className="block text-xs text-muted-foreground tabular-nums">
          {money(b.basket_ttc)}
        </span>
      </span>
    );
  };

  const headerName = (storeId: string | null, fallback: string) =>
    storeId ? (byId.get(storeId)?.name ?? fallback) : fallback;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // DialogContent's default caps width at sm:max-w-lg; the head-to-head
        // table needs room, so widen it on desktop (the sm: variant must be
        // overridden, not the base, or the default wins at ≥640px) and cap the
        // height so a long section scrolls inside the modal.
        className="max-h-[85vh] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-4xl"
        data-testid="section-compare-dialog"
      >
        <DialogHeader>
          <DialogTitle>
            {t("compareShopsSectionTitle", { name: poste.name })}
          </DialogTitle>
          <DialogDescription>{t("compareHeadToHeadSubtitle")}</DialogDescription>
        </DialogHeader>

        {poste.store_baskets.length > 0 ? (
          <StoreComparison
            baskets={poste.store_baskets}
            stores={stores}
            bestMixHt={poste.subtotal_ht}
            title={t("compareAllShopsTitle")}
            subtitle={t("compareShopsSectionSubtitle")}
          />
        ) : null}

        <div className="flex gap-3">
          {picker(shopAId, shopA, setShopA, t("compareDialogShopA"))}
          {picker(shopBId, shopB, setShopB, t("compareDialogShopB"))}
        </div>

        <div className="overflow-x-auto">
          <table
            className="w-full min-w-[560px] text-sm"
            data-testid="section-compare-table"
          >
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">
                  {t("compareItemColumn")}
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  {t("quantityShort")}
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  {headerName(shopA, t("compareDialogShopA"))}
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  {headerName(shopB, t("compareDialogShopB"))}
                </th>
              </tr>
            </thead>
            <tbody>
              {articles.map((a) => {
                const pa = priceAt(a, shopA);
                const pb = priceAt(a, shopB);
                const aCheaper = pa != null && pb != null && pa.ht < pb.ht;
                const bCheaper = pa != null && pb != null && pb.ht < pa.ht;
                return (
                  <tr
                    key={a.id}
                    className="border-b last:border-0"
                    data-testid="section-compare-row"
                  >
                    <td className="px-3 py-2">{a.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {quantity(a.quantity)}
                      {a.unit ? ` ${a.unit}` : ""}
                    </td>
                    <td className="px-3 py-2 text-right align-top">
                      {priceCell(pa, aCheaper)}
                    </td>
                    <td className="px-3 py-2 text-right align-top">
                      {priceCell(pb, bCheaper)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 font-medium">
                <td className="px-3 py-2" colSpan={2}>
                  {t("compareBasketRow")}
                </td>
                <td className="px-3 py-2 text-right align-top">
                  {basketCell(basketFor(shopA))}
                </td>
                <td className="px-3 py-2 text-right align-top">
                  {basketCell(basketFor(shopB))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">{t("compareUnitNote")}</p>
      </DialogContent>
    </Dialog>
  );
}
