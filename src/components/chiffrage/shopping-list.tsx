"use client";

/**
 * Shopping list: every article grouped by section, with a tick for "bought"
 * and the amount really paid, next to the estimate. Estimate and spend are
 * both TTC so they can be compared line by line.
 */

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ClipboardCopy, Printer } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DecimalInput } from "@/components/ui/decimal-input";
import { money, quantity, unitLabel } from "@/components/chiffrage/format";
import type { ChiffrageArticle, ChiffragePoste, ChiffrageTree } from "@/lib/api/chiffrage";

interface Props {
  tree: ChiffrageTree;
  canManage: boolean;
  /** Ids of articles whose change is being saved. */
  busyIds: Set<string>;
  onTogglePurchased: (article: ChiffrageArticle, purchased: boolean) => void;
  onSetActual: (article: ChiffrageArticle, actual: number | null) => void;
}

/** Spend entered for a line: committed on blur or Enter, not on every keystroke. */
function ActualInput({
  article,
  disabled,
  onCommit,
}: {
  article: ChiffrageArticle;
  disabled: boolean;
  onCommit: (value: number | null) => void;
}) {
  const t = useTranslations("chiffrage");
  const saved = article.actual_ttc === null ? "" : String(article.actual_ttc);
  const [value, setValue] = useState(saved);

  const commit = () => {
    if (value === saved) return;
    if (value.trim() === "") return onCommit(null);
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) {
      setValue(saved);
      return;
    }
    onCommit(n);
  };

  return (
    <DecimalInput
      value={value}
      onValueChange={setValue}
      maxDecimals={2}
      disabled={disabled}
      aria-label={t("actualAmount")}
      placeholder={t("actualPlaceholder")}
      className="h-8 w-28 text-right tabular-nums"
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

export function ShoppingList({ tree, canManage, busyIds, onTogglePurchased, onSetActual }: Props) {
  const t = useTranslations("chiffrage");
  const [onlyToBuy, setOnlyToBuy] = useState(false);
  const roomName = useMemo(() => new Map(tree.rooms.map((r) => [r.id, r.name])), [tree.rooms]);

  const all = tree.postes.flatMap((p) => p.articles);
  const bought = all.filter((a) => a.purchased);
  const estimatedBought = bought.reduce((s, a) => s + a.total_ttc, 0);
  const toBuyEstimate = all.filter((a) => !a.purchased).reduce((s, a) => s + a.total_ttc, 0);
  const diff = tree.actual_ttc - estimatedBought;

  const copyList = async () => {
    const lines: string[] = [];
    for (const poste of tree.postes) {
      const todo = poste.articles.filter((a) => !a.purchased);
      if (todo.length === 0) continue;
      lines.push(poste.name);
      for (const a of todo) {
        lines.push(`- ${a.name}: ${quantity(a.quantity)}${a.unit ? ` ${unitLabel(a.unit, t)}` : ""}`);
      }
      lines.push("");
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n").trim());
      toast.success(t("listCopied"));
    } catch {
      toast.error(t("actionFailed"));
    }
  };

  const visible = (poste: ChiffragePoste) =>
    onlyToBuy ? poste.articles.filter((a) => !a.purchased) : poste.articles;

  return (
    <div className="space-y-4" data-testid="shopping-list">
      <div className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("progress")}</p>
          <p className="text-lg font-semibold tabular-nums">
            {tree.purchased_count}/{tree.article_count}
          </p>
          <p className="text-xs text-muted-foreground">{t("boughtItems")}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("toBuyEstimate")}</p>
          <p className="text-lg font-semibold tabular-nums">{money(toBuyEstimate)}</p>
          <p className="text-xs text-muted-foreground">{t("includingTax")}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("actualSpend")}</p>
          <p className="text-lg font-semibold tabular-nums" data-testid="actual-total">
            {money(tree.actual_ttc)}
          </p>
          <p className="text-xs text-muted-foreground">{t("includingTax")}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("vsEstimate")}</p>
          <p
            className={`text-lg font-semibold tabular-nums ${
              bought.length === 0
                ? ""
                : diff > 0
                  ? "text-red-600 dark:text-red-400"
                  : "text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {bought.length === 0 ? "—" : `${diff > 0 ? "+" : ""}${money(diff)}`}
          </p>
          <p className="text-xs text-muted-foreground">{t("vsEstimateHint")}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={onlyToBuy}
            onChange={(e) => setOnlyToBuy(e.target.checked)}
          />
          {t("onlyToBuy")}
        </label>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={copyList}>
            <ClipboardCopy className="mr-1 h-4 w-4" />
            {t("copyList")}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-1 h-4 w-4" />
            {t("printList")}
          </Button>
        </div>
      </div>

      {tree.postes.map((poste) => {
        const rows = visible(poste);
        if (rows.length === 0) return null;
        return (
          <section key={poste.id} className="rounded-lg border bg-card" data-testid="shopping-poste">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
              <div>
                <h3 className="font-semibold">{poste.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {t("boughtOf", { done: poste.purchased_count, total: poste.articles.length })}
                </p>
              </div>
              <div className="text-right text-sm tabular-nums">
                <p>
                  <span className="text-muted-foreground">{t("estimateShort")}</span> {money(poste.subtotal_ttc)}
                </p>
                <p>
                  <span className="text-muted-foreground">{t("actualShort")}</span> {money(poste.actual_ttc)}
                </p>
              </div>
            </header>
            <ul>
              {rows.map((a) => {
                const busy = busyIds.has(a.id);
                return (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center gap-3 border-b px-3 py-2 last:border-0"
                    data-testid="shopping-row"
                  >
                    <input
                      type="checkbox"
                      className="h-5 w-5 shrink-0"
                      checked={a.purchased}
                      disabled={!canManage || busy}
                      aria-label={t("markBought", { name: a.name })}
                      onChange={(e) => onTogglePurchased(a, e.target.checked)}
                    />
                    <div className="min-w-[10rem] flex-1">
                      <p className={a.purchased ? "text-muted-foreground line-through" : "font-medium"}>{a.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {quantity(a.quantity)}
                        {a.unit ? ` ${unitLabel(a.unit, t)}` : ""}
                        {a.room_id && roomName.get(a.room_id) ? ` · ${roomName.get(a.room_id)}` : ""}
                      </p>
                    </div>
                    <p className="w-24 text-right text-sm tabular-nums text-muted-foreground">
                      {a.effective_source === "none" ? t("noPrice") : money(a.total_ttc)}
                    </p>
                    <div className="w-28 text-right">
                      {a.purchased ? (
                        canManage ? (
                          <ActualInput
                            key={`${a.id}-${a.actual_ttc}`}
                            article={a}
                            disabled={busy}
                            onCommit={(v) => onSetActual(a, v)}
                          />
                        ) : (
                          <span className="text-sm tabular-nums">
                            {a.actual_ttc === null ? "—" : money(a.actual_ttc)}
                          </span>
                        )
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
