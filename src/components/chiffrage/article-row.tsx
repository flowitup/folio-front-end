"use client";

/**
 * One article line: what to buy, how much, at which effective price, with its
 * fournisseur comparison folded underneath.
 */

import { useTranslations } from "next-intl";
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QuoteComparisonTable } from "@/components/chiffrage/quote-comparison-table";
import { money, quantity } from "@/components/chiffrage/format";
import type { ChiffrageArticle, ChiffrageQuote } from "@/lib/api/chiffrage";

interface Props {
  article: ChiffrageArticle;
  canManage: boolean;
  expanded: boolean;
  busyQuoteId: string | null;
  dragHandle?: React.ReactNode;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddQuote: () => void;
  onSelectQuote: (quote: ChiffrageQuote) => void;
  onEditQuote: (quote: ChiffrageQuote) => void;
  onDeleteQuote: (quote: ChiffrageQuote) => void;
}

export function ArticleRow({
  article,
  canManage,
  expanded,
  busyQuoteId,
  dragHandle,
  onToggle,
  onEdit,
  onDelete,
  onAddQuote,
  onSelectQuote,
  onEditQuote,
  onDeleteQuote,
}: Props) {
  const t = useTranslations("chiffrage");
  const unpriced = article.effective_source === "none";

  return (
    <div className="border-b last:border-0" data-testid="article-row">
      <div className="flex items-center gap-2 px-3 py-2">
        {dragHandle ?? (canManage ? <span className="w-4" /> : null)}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 shrink-0 p-0"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={expanded ? t("collapseQuotes") : t("expandQuotes")}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{article.name}</span>
            <span className="text-sm text-muted-foreground">
              {quantity(article.quantity)}
              {article.unit ? ` ${article.unit}` : ""}
            </span>
            {unpriced ? <Badge variant="outline">{t("noPrice")}</Badge> : null}
            {article.effective_source === "cheapest" ? (
              <Badge variant="secondary">{t("autoCheapest")}</Badge>
            ) : null}
            {article.effective_source === "selected" ? (
              <Badge>{t("retained")}</Badge>
            ) : null}
          </div>
          {article.note ? (
            <p className="text-xs text-muted-foreground">{article.note}</p>
          ) : null}
        </div>

        <div className="shrink-0 text-right">
          <p className="font-medium tabular-nums">{money(article.total_ht)}</p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {money(article.total_ttc)} {t("ttcShort")}
          </p>
        </div>

        {canManage ? (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onAddQuote}
              title={t("addQuote")}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onEdit}
              aria-label={t("editArticle")}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onDelete}
              aria-label={t("deleteArticle")}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </div>

      {expanded ? (
        <div className="bg-muted/30">
          <QuoteComparisonTable
            article={article}
            canManage={canManage}
            busyQuoteId={busyQuoteId}
            onSelect={onSelectQuote}
            onEdit={onEditQuote}
            onDelete={onDeleteQuote}
          />
        </div>
      ) : null}
    </div>
  );
}

/** Shared drag-handle visual so the poste and article lists look identical. */
export function DragHandle(props: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      {...props}
      className="flex h-6 w-4 cursor-grab items-center justify-center text-muted-foreground active:cursor-grabbing"
    >
      <GripVertical className="h-4 w-4" />
    </span>
  );
}
