"use client";

/**
 * Grand totals for the whole chiffrage, plus a warning when some articles have
 * no quote yet — without it an incomplete budget reads as a complete one.
 */

import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";

import { money } from "@/components/chiffrage/format";
import type { ChiffrageTree } from "@/lib/api/chiffrage";

export function ChiffrageTotals({ tree }: { tree: ChiffrageTree }) {
  const t = useTranslations("chiffrage");

  return (
    <div
      className="rounded-lg border bg-card p-4"
      data-testid="chiffrage-totals"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("estimatedTotal")}
          </p>
          <p className="text-2xl font-semibold tabular-nums">
            {money(tree.total_ht)}
          </p>
          <p className="text-xs text-muted-foreground">{t("excludingTax")}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-medium tabular-nums">
            {money(tree.total_ttc)}
          </p>
          <p className="text-xs text-muted-foreground">{t("includingTax")}</p>
        </div>
      </div>
      {tree.unpriced_article_count > 0 ? (
        <p
          className="mt-3 flex items-center gap-2 text-sm text-amber-600 dark:text-amber-500"
          data-testid="unpriced-warning"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {t("unpricedWarning", { count: tree.unpriced_article_count })}
        </p>
      ) : null}
    </div>
  );
}
