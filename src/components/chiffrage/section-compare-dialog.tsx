"use client";

/**
 * Head-to-head shop comparison for one section, opened from its Compare button.
 *
 * Laid out as a ledger: the basket strip across the top says what the whole
 * section costs at each shop, then two shops are picked and every item is a
 * row — unit price at each, the cheaper side dotted green, and the gap per
 * unit in the last column. Prices come straight from the recorded quotes; a
 * shop with no quote for an item says "No quote", never a zero, so a gap can
 * never read as free.
 *
 * Prices alone do not say *why* two shops differ — the quote notes do (sizes,
 * options, discount, catalogue price). Each row opens to a one-line gap
 * explanation and both notes with the words unique to one side highlighted.
 * "Expand all differences" opens every row at once; the choice is kept in
 * localStorage so it survives reopening, and `showDifferencesDefault` seeds it
 * the first time.
 */

import { Fragment, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronRight, ListChecks } from "lucide-react";

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
import { CompareBasketStrip } from "@/components/chiffrage/compare-basket-strip";
import { CompareLineDetails } from "@/components/chiffrage/compare-line-details";
import {
  buildCompareLines,
  formatGapPercent,
  summarizeLines,
  type CompareLine,
} from "@/components/chiffrage/compare-lines";
import { money, quantity } from "@/components/chiffrage/format";
import { NOTE_DIFF_MARK_CLASS } from "@/components/chiffrage/note-diff-text";
import type {
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
  /** Whether rows start expanded when nothing has been remembered yet. */
  showDifferencesDefault?: boolean;
}

/** Remembers whether the note differences are expanded. */
export const SHOW_DIFFERENCES_STORAGE_KEY = "chiffrage.compareShowDifferences";

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

/** The remembered choice, or null when nothing was stored (or storage is off). */
function readShowDifferences(): boolean | null {
  try {
    const raw = localStorage.getItem(SHOW_DIFFERENCES_STORAGE_KEY);
    return raw === null ? null : raw === "1";
  } catch {
    return null;
  }
}

function writeShowDifferences(value: boolean): void {
  try {
    localStorage.setItem(SHOW_DIFFERENCES_STORAGE_KEY, value ? "1" : "0");
  } catch {
    // Nothing to do — the choice just won't be remembered.
  }
}

const NUM = "num tabular-nums";

export function SectionCompareDialog({
  open,
  poste,
  stores,
  onOpenChange,
  showDifferencesDefault = false,
}: Props) {
  const t = useTranslations("chiffrage");
  const [initialA, initialB] = defaultPair(poste);
  const [shopA, setShopA] = useState<string | null>(initialA);
  const [shopB, setShopB] = useState<string | null>(initialB);
  // The dialog only mounts once opened, on the client, so the remembered
  // choice can seed the state directly — no hydration to disagree with.
  const [allOpen, setAllOpen] = useState(
    () => readShowDifferences() ?? showDifferencesDefault,
  );
  // Per-row overrides on top of the all-open switch; cleared when it flips.
  const [rowOverrides, setRowOverrides] = useState<Record<string, boolean>>({});
  const shopAId = useId();
  const shopBId = useId();

  const byId = new Map(stores.map((s) => [s.id, s]));
  const nameOf = (storeId: string | null, fallback: string) =>
    storeId ? (byId.get(storeId)?.name ?? fallback) : fallback;
  const nameA = nameOf(shopA, t("compareDialogShopA"));
  const nameB = nameOf(shopB, t("compareDialogShopB"));

  const lines = buildCompareLines(poste.articles, shopA, shopB);
  const summary = summarizeLines(lines);
  const isOpen = (line: CompareLine) =>
    line.expandable && (rowOverrides[line.article.id] ?? allOpen);
  const anyOpen = lines.some(isOpen);

  const toggleAll = () => {
    const next = !allOpen;
    setAllOpen(next);
    setRowOverrides({});
    writeShowDifferences(next);
  };
  const toggleRow = (line: CompareLine) => {
    if (!line.expandable) return;
    const next = !isOpen(line);
    setRowOverrides((prev) => ({ ...prev, [line.article.id]: next }));
  };

  // The per-shop section basket comes straight from the server-built baskets
  // shown in the strip above, so the footer can never disagree with it. A shop
  // that prices nothing here has priced_article_count 0 — rendered as a dash,
  // not "0,00 €", so an empty basket never reads as free.
  const basketFor = (storeId: string | null) =>
    storeId
      ? (poste.store_baskets.find((b) => b.store_id === storeId) ?? null)
      : null;
  const basketA = basketFor(shopA);
  const basketB = basketFor(shopB);

  const picker = (
    id: string,
    letter: string,
    value: string | null,
    onChange: (v: string) => void,
    label: string,
  ) => (
    // A Radix Select trigger is a combobox button, not a form control, so it
    // is named with aria-labelledby rather than wrapped in a <label> (which
    // would forward its click and double-toggle the popover).
    <Select value={value ?? undefined} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-[11rem] gap-2" aria-labelledby={id}>
        <span id={id} className="sr-only">
          {label}
        </span>
        <span aria-hidden className="label-cap text-muted-foreground">
          {letter}
        </span>
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
  );

  const priceCell = (q: ChiffrageQuote | null, cheaper: boolean) => {
    if (!q) return <span className="text-muted-foreground">{t("compareNoQuote")}</span>;
    return (
      <span data-cheaper={cheaper ? "true" : undefined}>
        <span className={`${NUM} block`}>
          {cheaper ? (
            <span
              aria-hidden
              data-testid="cheaper-dot"
              className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[var(--positive)] align-middle"
            />
          ) : null}
          {money(q.unit_price_ht)}
        </span>
        <span className={`${NUM} block text-xs text-muted-foreground`}>
          {money(q.unit_price_ttc)} {t("ttcShort")}
        </span>
      </span>
    );
  };

  const gapCell = (line: CompareLine) => {
    const v = line.verdict;
    if (v.kind === "unpriced")
      return (
        <span className="text-muted-foreground">
          <span className={`${NUM} block`}>{t("compareNa")}</span>
          <span className="block text-xs">{t("compareNotComparable")}</span>
        </span>
      );
    if (v.kind === "tie")
      return (
        <span className="text-muted-foreground">
          <span className={`${NUM} block`}>—</span>
          <span className="block text-xs">{t("compareIdentical")}</span>
        </span>
      );
    const signed = v.gap > 0 ? `+${money(v.gap)}` : money(v.gap);
    return (
      <span>
        <span
          className={`${NUM} block ${v.gap > 0 ? "text-[var(--accent-ink)]" : ""}`}
          data-testid="compare-gap"
        >
          {signed}
        </span>
        <span className="block text-xs text-muted-foreground">
          {t("compareGapAt", {
            pct: formatGapPercent(v.pct),
            shop: v.cheaper === "a" ? nameB : nameA,
          })}
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
        <span className={`${NUM} block`}>{money(b.basket_ht)}</span>
        <span className={`${NUM} block text-xs font-normal text-muted-foreground`}>
          {money(b.basket_ttc)} {t("ttcShort")}
        </span>
      </span>
    );
  };

  const partialBaskets = [basketA, basketB].filter(
    (b) => b != null && b.priced_article_count > 0 && !b.covers_all,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // Large by default and user-resizable: `resize` + `overflow-auto` add a
        // drag grip at the bottom-right corner. The width caps must override the
        // `sm:` variant (DialogContent defaults to `sm:max-w-lg`, which wins at
        // ≥640px over any base width) — hence `sm:max-w-[…]`. Min/max keep the
        // drag inside sane bounds; the height caps at the viewport so a long
        // section scrolls inside rather than off-screen.
        className="flex max-h-[92vh] min-h-[24rem] w-[min(96vw,1280px)] max-w-[96vw] resize flex-col gap-0 overflow-auto p-0 sm:max-w-[96vw]"
        data-testid="section-compare-dialog"
      >
        <DialogHeader className="flex-row flex-wrap items-start justify-between gap-4 border-b px-6 py-4 pr-14 text-left">
          <div className="min-w-0">
            <p className="label-cap text-muted-foreground">{t("compareShopsEyebrow")}</p>
            <DialogTitle className="font-display text-2xl font-semibold leading-tight">
              {poste.name}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t("compareHeadToHeadSubtitle")}
            </DialogDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {picker(shopAId, "A", shopA, setShopA, t("compareDialogShopA"))}
            <span className="label-cap text-muted-foreground">vs</span>
            {picker(shopBId, "B", shopB, setShopB, t("compareDialogShopB"))}
          </div>
        </DialogHeader>

        <CompareBasketStrip
          baskets={poste.store_baskets}
          stores={stores}
          bestMixHt={poste.subtotal_ht}
        />

        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
          <p className="text-sm text-muted-foreground" data-testid="compare-summary">
            {t("compareSummary", {
              a: nameA,
              b: nameB,
              aWins: summary.aWins,
              bWins: summary.bWins,
              ties: summary.ties,
              unpriced: summary.unpriced,
            })}
            {" · "}
            {t("compareSummaryNotes", { count: summary.withNoteDifferences })}
          </p>
          <Button
            type="button"
            variant={allOpen ? "default" : "secondary"}
            size="sm"
            className="rounded-full"
            aria-pressed={allOpen}
            onClick={toggleAll}
            data-testid="compare-diff-toggle"
          >
            <ListChecks className="h-4 w-4" />
            <span className="ml-1">
              {allOpen ? t("compareCollapseAll") : t("compareExpandAll")}
            </span>
          </Button>
        </div>

        <div className="px-6 pb-5">
          <div className="overflow-x-auto rounded-lg border">
            <table
              className="w-full min-w-[720px] text-sm"
              data-testid="section-compare-table"
            >
              <thead>
                <tr className="label-cap border-b bg-secondary text-left text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">{t("compareItemColumn")}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{t("quantityShort")}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{nameA}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{nameB}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{t("compareGapColumn")}</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const a = line.article;
                  const expanded = isOpen(line);
                  const v = line.verdict;
                  return (
                    <Fragment key={a.id}>
                      <tr
                        className={`border-b ${line.expandable ? "cursor-pointer hover:bg-secondary/40" : ""} ${expanded ? "bg-secondary/30" : ""}`}
                        data-testid="section-compare-row"
                        data-expanded={expanded ? "true" : "false"}
                        onClick={() => toggleRow(line)}
                      >
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            {line.expandable ? (
                              <button
                                type="button"
                                aria-expanded={expanded}
                                aria-label={t("compareExpandRow", { name: a.name })}
                                className="shrink-0 rounded text-muted-foreground hover:text-foreground"
                                data-testid="compare-row-toggle"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleRow(line);
                                }}
                              >
                                <ChevronRight
                                  className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`}
                                />
                              </button>
                            ) : (
                              <span aria-hidden className="inline-block h-4 w-4 shrink-0" />
                            )}
                            <span className="font-medium">{a.name}</span>
                            {line.differenceCount > 0 ? (
                              <span
                                className="whitespace-nowrap rounded-full bg-[var(--accent-tint)] px-2 py-0.5 text-xs text-[var(--accent-ink)]"
                                data-testid="compare-difference-count"
                              >
                                {t("compareDifferenceCount", { count: line.differenceCount })}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className={`${NUM} px-4 py-2.5 text-right text-muted-foreground`}>
                          {quantity(a.quantity)}
                          {a.unit ? ` ${a.unit}` : ""}
                        </td>
                        <td className="px-4 py-2.5 text-right align-top">
                          {priceCell(line.quoteA, v.kind === "gap" && v.cheaper === "a")}
                        </td>
                        <td className="px-4 py-2.5 text-right align-top">
                          {priceCell(line.quoteB, v.kind === "gap" && v.cheaper === "b")}
                        </td>
                        <td className="px-4 py-2.5 text-right align-top">{gapCell(line)}</td>
                      </tr>
                      {expanded ? (
                        <tr
                          className="border-b bg-secondary/30"
                          data-testid="section-compare-note-row"
                        >
                          <td className="px-4 pb-4 pt-1" colSpan={5}>
                            <CompareLineDetails
                              line={line}
                              shopAName={nameA}
                              shopBName={nameB}
                            />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-secondary/60 font-medium">
                  <td className="px-4 py-3" colSpan={2}>
                    {t("compareBasketRow")}
                  </td>
                  <td className="px-4 py-3 text-right align-top">{basketCell(basketA)}</td>
                  <td className="px-4 py-3 text-right align-top">{basketCell(basketB)}</td>
                  <td
                    className="px-4 py-3 text-right align-top text-xs font-normal"
                    data-testid="compare-footer-coverage"
                  >
                    {partialBaskets.length > 0 ? (
                      partialBaskets.map((b) => (
                        <span
                          key={b!.store_id}
                          className="block text-[var(--accent-ink)]"
                        >
                          {t("comparePartialFooter", {
                            priced: b!.priced_article_count,
                            total: b!.total_article_count,
                          })}
                        </span>
                      ))
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <p>{t("compareUnitNote")}</p>
            {anyOpen ? (
              <p data-testid="compare-diff-legend">
                <mark className={NOTE_DIFF_MARK_CLASS}>{t("compareDiffLegendSample")}</mark>{" "}
                {t("compareDiffLegend")}
              </p>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
