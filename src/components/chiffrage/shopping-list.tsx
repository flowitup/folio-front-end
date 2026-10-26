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
import type {
  ChiffrageArticle,
  ChiffragePoste,
  ChiffrageTree,
} from "@/lib/api/chiffrage";

interface Props {
  tree: ChiffrageTree;
  canManage: boolean;
  /** Ids of articles whose change is being saved. */
  busyIds: Set<string>;
  onTogglePurchased: (article: ChiffrageArticle, purchased: boolean) => void;
  onSetQuantities: (
    article: ChiffrageArticle,
    change: {
      purchased_quantity?: number | null;
      returned_quantity?: number | null;
    },
  ) => void;
}

/** A quantity typed for a line: committed on blur or Enter, not on every keystroke. */
function QuantityInput({
  label,
  value,
  disabled,
  onCommit,
}: {
  label: string;
  value: number | null;
  disabled: boolean;
  onCommit: (value: number | null) => void;
}) {
  const saved = value === null ? "" : String(value);
  const [text, setText] = useState(saved);

  const commit = () => {
    if (text === saved) return;
    if (text.trim() === "") return onCommit(null);
    const n = Number(text);
    if (!Number.isFinite(n) || n < 0) {
      setText(saved);
      return;
    }
    onCommit(n);
  };

  return (
    <label className="flex items-center gap-1 text-xs text-muted-foreground">
      {label}
      <DecimalInput
        value={text}
        onValueChange={setText}
        maxDecimals={3}
        disabled={disabled}
        aria-label={label}
        className="h-8 w-20 text-right tabular-nums"
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
    </label>
  );
}

/** What a bought line cost beyond (+) or under (-) its estimate, from the quantities bought and returned. */
const lineGap = (a: ChiffrageArticle): number | null =>
  a.purchased && a.actual_ttc !== null ? a.actual_ttc - a.total_ttc : null;

const sumGaps = (articles: ChiffrageArticle[]): number =>
  articles.reduce((s, a) => s + (lineGap(a) ?? 0), 0);

/** Signed gap, red when over the estimate and green when under; nothing when it is zero. */
function Gap({ value, testId }: { value: number; testId?: string }) {
  if (Math.abs(value) < 0.005) return null;
  return (
    <span
      data-testid={testId}
      className={`tabular-nums ${value > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}
    >
      {value > 0 ? "+" : ""}
      {money(value)}
    </span>
  );
}

export function ShoppingList({
  tree,
  canManage,
  busyIds,
  onTogglePurchased,
  onSetQuantities,
}: Props) {
  const t = useTranslations("chiffrage");
  const [onlyToBuy, setOnlyToBuy] = useState(false);
  const roomName = useMemo(
    () => new Map(tree.rooms.map((r) => [r.id, r.name])),
    [tree.rooms],
  );

  const all = tree.postes.flatMap((p) => p.articles);
  const bought = all.filter((a) => a.purchased);
  const toBuyEstimate = all
    .filter((a) => !a.purchased)
    .reduce((s, a) => s + a.total_ttc, 0);
  const diff = sumGaps(all);

  const copyList = async () => {
    const lines: string[] = [];
    for (const poste of tree.postes) {
      const todo = poste.articles.filter((a) => !a.purchased);
      if (todo.length === 0) continue;
      lines.push(poste.name);
      for (const a of todo) {
        lines.push(
          `- ${a.name}: ${quantity(a.quantity)}${a.unit ? ` ${unitLabel(a.unit, t)}` : ""}`,
        );
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
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("progress")}
          </p>
          <p className="text-lg font-semibold tabular-nums">
            {tree.purchased_count}/{tree.article_count}
          </p>
          <p className="text-xs text-muted-foreground">{t("boughtItems")}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("toBuyEstimate")}
          </p>
          <p className="text-lg font-semibold tabular-nums">
            {money(toBuyEstimate)}
          </p>
          <p className="text-xs text-muted-foreground">{t("includingTax")}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("actualSpend")}
          </p>
          <p
            className="text-lg font-semibold tabular-nums"
            data-testid="actual-total"
          >
            {money(tree.actual_ttc)}
          </p>
          <p className="text-xs text-muted-foreground">{t("includingTax")}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("vsEstimate")}
          </p>
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.print()}
          >
            <Printer className="mr-1 h-4 w-4" />
            {t("printList")}
          </Button>
        </div>
      </div>

      {tree.postes.map((poste) => {
        const rows = visible(poste);
        if (rows.length === 0) return null;
        return (
          <section
            key={poste.id}
            className="rounded-lg border bg-card"
            data-testid="shopping-poste"
          >
            <header className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
              <div>
                <h3 className="font-semibold">{poste.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {t("boughtOf", {
                    done: poste.purchased_count,
                    total: poste.articles.length,
                  })}
                </p>
              </div>
              <div className="text-right text-sm tabular-nums">
                <p>
                  <span className="text-muted-foreground">
                    {t("estimateShort")}
                  </span>{" "}
                  {money(poste.subtotal_ttc)}
                </p>
                <p>
                  <span className="text-muted-foreground">
                    {t("actualShort")}
                  </span>{" "}
                  {money(poste.actual_ttc)}
                </p>
                {sumGaps(poste.articles) !== 0 ? (
                  <p>
                    <span className="text-muted-foreground">
                      {t("gapShort")}
                    </span>{" "}
                    <Gap value={sumGaps(poste.articles)} testId="poste-gap" />
                  </p>
                ) : null}
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
                      <p
                        className={
                          a.purchased
                            ? "text-muted-foreground line-through"
                            : "font-medium"
                        }
                      >
                        {a.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {quantity(a.quantity)}
                        {a.unit ? ` ${unitLabel(a.unit, t)}` : ""}
                        {a.room_id && roomName.get(a.room_id)
                          ? ` · ${roomName.get(a.room_id)}`
                          : ""}
                      </p>
                    </div>
                    <p className="w-24 text-right text-sm tabular-nums text-muted-foreground">
                      {a.effective_source === "none"
                        ? t("noPrice")
                        : money(a.total_ttc)}
                    </p>
                    <div className="w-28 text-right">
                      {a.purchased ? (
                        <>
                          <p
                            className="text-sm tabular-nums"
                            data-testid="line-actual"
                          >
                            {money(a.actual_ttc ?? 0)}
                          </p>
                          {lineGap(a) !== null ? (
                            <p className="text-xs" data-testid="line-gap">
                              <Gap value={lineGap(a) as number} />
                            </p>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                    {a.purchased ? (
                      <div className="flex basis-full flex-wrap items-center gap-3 pl-8">
                        {canManage ? (
                          <>
                            <QuantityInput
                              key={`b-${a.id}-${a.purchased_quantity}`}
                              label={t("boughtQuantity")}
                              value={a.purchased_quantity}
                              disabled={busy}
                              onCommit={(v) =>
                                onSetQuantities(a, { purchased_quantity: v })
                              }
                            />
                            <QuantityInput
                              key={`r-${a.id}-${a.returned_quantity}`}
                              label={t("returnedQuantity")}
                              value={a.returned_quantity}
                              disabled={busy}
                              onCommit={(v) =>
                                onSetQuantities(a, { returned_quantity: v })
                              }
                            />
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            {t("boughtQuantity")}{" "}
                            {quantity(a.purchased_quantity ?? 0)} ·{" "}
                            {t("returnedQuantity")}{" "}
                            {quantity(a.returned_quantity ?? 0)}
                          </p>
                        )}
                        {a.unit ? (
                          <span className="text-xs text-muted-foreground">
                            {unitLabel(a.unit, t)}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
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
