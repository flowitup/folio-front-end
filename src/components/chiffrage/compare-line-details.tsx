"use client";

/**
 * What opens under a ledger row: one sentence on the price gap, then both
 * quote notes side by side with the words unique to each highlighted — so a
 * gap reads as "radio vs filaire, 42 % vs 35 % off", not just a number.
 */

import { useTranslations } from "next-intl";

import { formatGapPercent, type CompareLine } from "@/components/chiffrage/compare-lines";
import { money, quantity } from "@/components/chiffrage/format";
import { NoteDiffText } from "@/components/chiffrage/note-diff-text";
import type { NoteSegment } from "@/components/chiffrage/quote-note-diff";
import type { ChiffrageQuote } from "@/lib/api/chiffrage";

interface Props {
  line: CompareLine;
  shopAName: string;
  shopBName: string;
}

export function CompareLineDetails({ line, shopAName, shopBName }: Props) {
  const t = useTranslations("chiffrage");
  const { article, quoteA, quoteB, verdict } = line;

  const explanation = () => {
    if (verdict.kind === "tie") return t("compareTieExplanation");
    if (verdict.kind === "unpriced")
      return t("compareUnpricedExplanation", {
        shop: quoteA ? shopBName : shopAName,
      });
    const dearer = verdict.cheaper === "a" ? shopBName : shopAName;
    const cheaper = verdict.cheaper === "a" ? shopAName : shopBName;
    const gap = Math.abs(verdict.gap);
    const values = {
      dearer,
      cheaper,
      gap: money(gap),
      lineGap: money(gap * article.quantity),
      qty: `${quantity(article.quantity)}${article.unit ? ` ${article.unit}` : ""}`,
    };
    // No percentage when the cheaper price is 0 € — a ratio against zero
    // would read as "no difference".
    return verdict.pct === null
      ? t("compareGapExplanationNoPct", values)
      : t("compareGapExplanation", {
          ...values,
          pct: formatGapPercent(Math.abs(verdict.pct)),
        });
  };

  // A shop with a quote but no note reads "No note"; a shop with no quote at
  // all says so — the card stays, so the two columns never shift.
  const noteBody = (q: ChiffrageQuote | null, segments: NoteSegment[]) => {
    if (!q) return <span className="text-muted-foreground">{t("compareNoQuote")}</span>;
    if (!q.note) return <span className="italic text-muted-foreground">{t("compareNoNote")}</span>;
    return <NoteDiffText segments={segments} />;
  };

  const card = (
    side: "a" | "b",
    shopName: string,
    q: ChiffrageQuote | null,
    segments: NoteSegment[],
  ) => (
    <div
      className="rounded-md border bg-background p-3 text-sm"
      data-testid={`compare-note-${side}`}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="label-cap text-muted-foreground">
          {t("compareQuoteNoteLabel", { shop: shopName })}
        </span>
        {verdict.kind === "gap" && verdict.cheaper === side ? (
          <span className="text-xs font-medium text-[var(--positive)]">
            {t("compareCheaperLabel")}
          </span>
        ) : null}
      </div>
      {noteBody(q, segments)}
    </div>
  );

  return (
    <div className="space-y-3">
      <p className="flex items-start gap-2 text-sm" data-testid="compare-gap-explanation">
        <span
          aria-hidden
          className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]"
        />
        <span>{explanation()}</span>
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {card("a", shopAName, quoteA, line.notesA)}
        {card("b", shopBName, quoteB, line.notesB)}
      </div>
    </div>
  );
}
