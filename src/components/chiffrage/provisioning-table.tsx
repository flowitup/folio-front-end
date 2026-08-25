"use client";

/**
 * The provisioning table — the deliverable of this page.
 *
 * One row per article that has a price, showing which fournisseur was retained
 * and what it costs, so the list can be worked through purchase by purchase.
 * Unpriced articles are deliberately excluded: they contribute nothing to the
 * total and would read as free.
 */

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { money, quantity } from "@/components/chiffrage/format";
import { shopNameFor } from "@/components/chiffrage/shop-label";
import type { ChiffrageTree } from "@/lib/api/chiffrage";

export function ProvisioningTable({ tree }: { tree: ChiffrageTree }) {
  const t = useTranslations("chiffrage");

  const rows = tree.postes.flatMap((poste) =>
    poste.articles
      .filter((article) => article.effective_quote_id !== null)
      .map((article) => {
        const quote = article.quotes.find(
          (q) => q.id === article.effective_quote_id,
        );
        return { poste, article, quote };
      }),
  );

  if (rows.length === 0) {
    return null;
  }

  return (
    <section className="rounded-lg border bg-card">
      <header className="border-b px-4 py-3">
        <h2 className="font-semibold">{t("provisioningTitle")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("provisioningSubtitle")}
        </p>
      </header>
      <div className="overflow-x-auto">
        <table
          className="w-full min-w-[720px] text-sm"
          data-testid="provisioning-table"
        >
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2 font-medium">{t("poste")}</th>
              <th className="px-4 py-2 font-medium">{t("article")}</th>
              <th className="px-4 py-2 text-right font-medium">
                {t("quantityShort")}
              </th>
              <th className="px-4 py-2 font-medium">{t("supplier")}</th>
              <th className="px-4 py-2 text-right font-medium">
                {t("unitPriceHt")}
              </th>
              <th className="px-4 py-2 text-right font-medium">
                {t("totalHt")}
              </th>
              <th className="px-4 py-2 text-right font-medium">
                {t("totalTtc")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ poste, article, quote }) => (
              <tr key={article.id} className="border-b last:border-0">
                <td className="px-4 py-2 text-muted-foreground">
                  {poste.name}
                </td>
                <td className="px-4 py-2 font-medium">{article.name}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {quantity(article.quantity)}
                  {article.unit ? (
                    <span className="ml-1 text-muted-foreground">
                      {article.unit}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-2">
                  <span className="mr-2">
                    {shopNameFor(quote, tree.stores) ?? t("unnamedSupplier")}
                  </span>
                  {article.effective_source === "cheapest" ? (
                    <Badge variant="secondary">{t("autoCheapest")}</Badge>
                  ) : null}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {money(quote?.unit_price_ht ?? 0)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {money(article.total_ht)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {money(article.total_ttc)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 font-semibold">
              <td className="px-4 py-2" colSpan={5}>
                {t("grandTotal")}
              </td>
              <td className="px-4 py-2 text-right tabular-nums">
                {money(tree.total_ht)}
              </td>
              <td className="px-4 py-2 text-right tabular-nums">
                {money(tree.total_ttc)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
