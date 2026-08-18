"use client";

/**
 * Side-by-side fournisseur comparison for one article.
 *
 * Every quote is shown HT *and* TTC because suppliers publish inconsistently;
 * the delta column is computed against the cheapest HT so the user can see what
 * choosing a dearer offer actually costs before deciding.
 */

import { useTranslations } from "next-intl";
import { Check, ExternalLink, Pencil, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  deltaVsCheapest,
  formatDelta,
  money,
} from "@/components/chiffrage/format";
import type { ChiffrageArticle, ChiffrageQuote } from "@/lib/api/chiffrage";

interface Props {
  article: ChiffrageArticle;
  canManage: boolean;
  busyQuoteId: string | null;
  onSelect: (quote: ChiffrageQuote) => void;
  onEdit: (quote: ChiffrageQuote) => void;
  onDelete: (quote: ChiffrageQuote) => void;
}

export function QuoteComparisonTable({
  article,
  canManage,
  busyQuoteId,
  onSelect,
  onEdit,
  onDelete,
}: Props) {
  const t = useTranslations("chiffrage");

  if (article.quotes.length === 0) {
    return (
      <p className="px-4 py-3 text-sm text-muted-foreground">
        {t("noQuotesYet")}
      </p>
    );
  }

  const cheapest = Math.min(...article.quotes.map((q) => q.unit_price_ht));

  return (
    <div className="overflow-x-auto">
      <table
        className="w-full min-w-[640px] text-sm"
        data-testid="quote-comparison-table"
      >
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2 font-medium">{t("supplier")}</th>
            <th className="px-4 py-2 text-right font-medium">
              {t("unitPriceHt")}
            </th>
            <th className="px-4 py-2 text-right font-medium">{t("tva")}</th>
            <th className="px-4 py-2 text-right font-medium">
              {t("unitPriceTtc")}
            </th>
            <th className="px-4 py-2 text-right font-medium">{t("delta")}</th>
            <th className="px-4 py-2 text-right font-medium sr-only">
              {t("actions")}
            </th>
          </tr>
        </thead>
        <tbody>
          {article.quotes.map((q) => {
            const isEffective = q.id === article.effective_quote_id;
            const isCheapest = q.unit_price_ht === cheapest;
            const delta = deltaVsCheapest(q.unit_price_ht, cheapest);
            return (
              <tr
                key={q.id}
                data-testid="quote-row"
                data-effective={isEffective ? "true" : "false"}
                className={isEffective ? "border-b bg-primary/5" : "border-b"}
              >
                <td className="px-4 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {q.supplier_name ?? t("unnamedSupplier")}
                    </span>
                    {q.product_url ? (
                      <a
                        href={q.product_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                        aria-label={t("openProductPage")}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : null}
                    {isEffective && article.effective_source === "selected" ? (
                      <Badge variant="default">{t("retained")}</Badge>
                    ) : null}
                    {isEffective && article.effective_source === "cheapest" ? (
                      <Badge variant="secondary">{t("autoCheapest")}</Badge>
                    ) : null}
                    {!isEffective && isCheapest ? (
                      <Badge variant="outline">{t("cheapest")}</Badge>
                    ) : null}
                  </div>
                  {q.note ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {q.note}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {money(q.unit_price_ht)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                  {q.tva_rate}%
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {money(q.unit_price_ttc)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                  {delta === null ? "—" : formatDelta(delta)}
                </td>
                <td className="px-4 py-2">
                  {canManage ? (
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant={q.is_selected ? "secondary" : "ghost"}
                        disabled={q.is_selected || busyQuoteId === q.id}
                        onClick={() => onSelect(q)}
                        title={t("retainThisQuote")}
                      >
                        <Check className="h-4 w-4" />
                        <span className="ml-1 hidden sm:inline">
                          {t("retain")}
                        </span>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => onEdit(q)}
                        aria-label={t("editQuote")}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => onDelete(q)}
                        aria-label={t("deleteQuote")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
