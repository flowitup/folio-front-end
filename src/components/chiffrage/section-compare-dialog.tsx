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
 *
 * Prices alone do not say *why* two shops differ — the quote notes do (sizes,
 * options, discount, catalogue price). "Show differences" adds a muted line
 * under each item with both notes, the words unique to one side highlighted.
 * It is off by default to keep the table readable, and the choice is kept in
 * localStorage so it survives reopening the dialog.
 */

import { Fragment, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { ListChecks } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import {
  NOTE_DIFF_MARK_CLASS,
  NoteDiffText,
} from "@/components/chiffrage/note-diff-text";
import {
  diffQuoteNotes,
  type NoteSegment,
} from "@/components/chiffrage/quote-note-diff";
import { StoreComparison } from "@/components/chiffrage/store-comparison";
import type {
  ChiffrageArticle,
  ChiffragePoste,
  ChiffrageQuote,
  ChiffrageStore,
} from "@/lib/api/chiffrage";

interface Props {
  open: boolean;
  poste: ChiffragePoste;
  /** Every project shop — you may compare one that prices nothing here. */
  stores: ChiffrageStore[];
  onOpenChange: (open: boolean) => void;
}

/** Remembers whether the note differences are expanded. */
export const SHOW_DIFFERENCES_STORAGE_KEY = "chiffrage.compareShowDifferences";

/** Cheapest recorded quote for an article at a shop, or null if none. */
function quoteAt(
  article: ChiffrageArticle,
  storeId: string | null,
): ChiffrageQuote | null {
  if (!storeId) return null;
  const quotes = article.quotes.filter((q) => q.store_id === storeId);
  if (quotes.length === 0) return null;
  return quotes.reduce((a, b) => (b.unit_price_ht < a.unit_price_ht ? b : a));
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

/** Read the remembered toggle; localStorage may be unavailable (private mode). */
function readShowDifferences(): boolean {
  try {
    return localStorage.getItem(SHOW_DIFFERENCES_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeShowDifferences(value: boolean): void {
  try {
    localStorage.setItem(SHOW_DIFFERENCES_STORAGE_KEY, value ? "1" : "0");
  } catch {
    // Nothing to do — the choice just won't be remembered.
  }
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
  // The dialog only mounts once opened, on the client, so the remembered
  // choice can seed the state directly — no hydration to disagree with.
  const [showDiff, setShowDiff] = useState(readShowDifferences);
  const shopAId = useId();
  const shopBId = useId();

  const toggleDiff = () => {
    const next = !showDiff;
    setShowDiff(next);
    writeShowDifferences(next);
  };

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

  const priceCell = (q: ChiffrageQuote | null, cheaper: boolean) => {
    if (!q) return <span className="text-muted-foreground">—</span>;
    return (
      <span className={cheaper ? "font-semibold text-primary" : undefined}>
        <span className="block tabular-nums">{money(q.unit_price_ht)}</span>
        <span className="block text-xs text-muted-foreground tabular-nums">
          {money(q.unit_price_ttc)}
        </span>
      </span>
    );
  };

  // A shop with a quote but no note reads "No note"; a shop with no quote at
  // all stays blank — the dash in the price cell above already says so.
  const noteCell = (q: ChiffrageQuote | null, segments: NoteSegment[]) => {
    if (!q) return null;
    if (!q.note) return <span className="italic">{t("compareNoNote")}</span>;
    return <NoteDiffText segments={segments} />;
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
        // Large by default and user-resizable: `resize` + `overflow-auto` add a
        // drag grip at the bottom-right corner. The width caps must override the
        // `sm:` variant (DialogContent defaults to `sm:max-w-lg`, which wins at
        // ≥640px over any base width) — hence `sm:max-w-[…]`. Min/max keep the
        // drag inside sane bounds; the height caps at the viewport so a long
        // section scrolls inside rather than off-screen.
        className="flex max-h-[92vh] min-h-[24rem] w-[min(96vw,1280px)] max-w-[96vw] resize flex-col overflow-auto sm:max-w-[96vw]"
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

        <div className="flex flex-wrap items-end gap-3">
          {picker(shopAId, shopA, setShopA, t("compareDialogShopA"))}
          {picker(shopBId, shopB, setShopB, t("compareDialogShopB"))}
          <Button
            type="button"
            variant={showDiff ? "secondary" : "outline"}
            size="sm"
            aria-pressed={showDiff}
            onClick={toggleDiff}
            data-testid="compare-diff-toggle"
          >
            <ListChecks className="h-4 w-4" />
            <span className="ml-1">
              {showDiff ? t("compareHideDifferences") : t("compareShowDifferences")}
            </span>
          </Button>
        </div>

        {showDiff ? (
          <p
            className="text-xs text-muted-foreground"
            data-testid="compare-diff-legend"
          >
            <mark className={NOTE_DIFF_MARK_CLASS}>
              {t("compareDiffLegendSample")}
            </mark>{" "}
            {t("compareDiffLegend")}
          </p>
        ) : null}

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
                const qa = quoteAt(a, shopA);
                const qb = quoteAt(a, shopB);
                const aCheaper =
                  qa != null && qb != null && qa.unit_price_ht < qb.unit_price_ht;
                const bCheaper =
                  qa != null && qb != null && qb.unit_price_ht < qa.unit_price_ht;
                // Only worth a line when at least one side has a quote to explain.
                const withNotes = showDiff && (qa != null || qb != null);
                const [segA, segB] = withNotes
                  ? diffQuoteNotes([qa?.note, qb?.note])
                  : [[], []];
                return (
                  <Fragment key={a.id}>
                    <tr
                      className={withNotes ? undefined : "border-b last:border-0"}
                      data-testid="section-compare-row"
                    >
                      <td className="px-3 py-2">{a.name}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {quantity(a.quantity)}
                        {a.unit ? ` ${a.unit}` : ""}
                      </td>
                      <td className="px-3 py-2 text-right align-top">
                        {priceCell(qa, aCheaper)}
                      </td>
                      <td className="px-3 py-2 text-right align-top">
                        {priceCell(qb, bCheaper)}
                      </td>
                    </tr>
                    {withNotes ? (
                      <tr
                        className="border-b text-xs text-muted-foreground last:border-0"
                        data-testid="section-compare-note-row"
                      >
                        <td className="px-3 pb-2 align-top" colSpan={2}>
                          {t("compareNotesRowLabel")}
                        </td>
                        <td className="max-w-xs px-3 pb-2 text-left align-top">
                          {noteCell(qa, segA)}
                        </td>
                        <td className="max-w-xs px-3 pb-2 text-left align-top">
                          {noteCell(qb, segB)}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
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
