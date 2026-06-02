"use client";

/**
 * TagSummaryTable — per-tag cost rollup (labor + expenses).
 * Displays one row per tag + an untagged bucket + grand total.
 * Currency formatted as EUR using the shared fr-FR formatter (cents, matching
 * the labor/invoice tabs — avoids visible rounding divergence).
 */

import { useTranslations } from "next-intl";
import { formatEUR } from "@/lib/api/labor";
import type { TagSummaryRow } from "@/lib/api/tags";

interface TagSummaryTableProps {
  rows: TagSummaryRow[];
}

export function TagSummaryTable({ rows }: TagSummaryTableProps) {
  const t = useTranslations("tags");

  const grandLaborCost = rows.reduce((s, r) => s + r.labor_cost, 0);
  const grandExpenseTotal = rows.reduce((s, r) => s + r.expense_total, 0);
  const grandTotal = grandLaborCost + grandExpenseTotal;

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        {t("summary.empty")}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("summary.colTag")}
            </th>
            <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("summary.colLaborCost")}
            </th>
            <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("summary.colExpenses")}
            </th>
            <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("summary.colTotal")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const rowTotal = row.labor_cost + row.expense_total;
            const isUntagged = row.tag_id === null;
            return (
              <tr key={row.tag_id ?? `untagged-${idx}`} className="border-b last:border-0">
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-2">
                    {isUntagged ? (
                      <span className="inline-block h-3 w-3 rounded-full bg-muted border border-border flex-shrink-0" />
                    ) : (
                      <span
                        className="inline-block h-3 w-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: row.tag_color ?? "#6b7280" }}
                        aria-hidden="true"
                      />
                    )}
                    <span className={isUntagged ? "text-muted-foreground italic" : "font-medium"}>
                      {isUntagged ? t("summary.untagged") : row.tag_name}
                    </span>
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-xs">
                  {formatEUR(row.labor_cost)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-xs">
                  {formatEUR(row.expense_total)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-xs font-semibold">
                  {formatEUR(rowTotal)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t bg-muted/30">
            <td className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide">
              {t("summary.grandTotal")}
            </td>
            <td className="px-4 py-2.5 text-right font-mono text-xs font-bold">
              {formatEUR(grandLaborCost)}
            </td>
            <td className="px-4 py-2.5 text-right font-mono text-xs font-bold">
              {formatEUR(grandExpenseTotal)}
            </td>
            <td className="px-4 py-2.5 text-right font-mono text-xs font-bold">
              {formatEUR(grandTotal)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
