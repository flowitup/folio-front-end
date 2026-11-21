"use client";

/**
 * Budget dashboard at the top of the chiffrage: totals, spend against the
 * estimate, one bar pair per section, and a short list of what needs
 * attention. The unpriced warning stays because without it an incomplete
 * budget reads as a complete one.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";

import { money } from "@/components/chiffrage/format";
import type { ChiffrageArticle, ChiffrageTree } from "@/lib/api/chiffrage";

const MAX_ALERTS = 6;

type Alert = { key: string; tone: "bad" | "warn" | "good" | "mute"; text: string };

/** Spend minus estimate for one bought article; 0 until it is bought. */
function gapOf(a: ChiffrageArticle): number {
  if (!a.purchased || a.actual_ttc == null) return 0;
  return Math.round((a.actual_ttc - a.total_ttc) * 100) / 100;
}

function gapClass(v: number): string {
  return v < 0 ? "text-emerald-600" : v > 0 ? "text-red-600" : "text-muted-foreground";
}

function signed(v: number): string {
  return `${v > 0 ? "+" : ""}${money(v)}`;
}

export function ChiffrageTotals({ tree }: { tree: ChiffrageTree }) {
  const t = useTranslations("chiffrage");
  const [showAllAlerts, setShowAllAlerts] = useState(false);

  const bought = tree.postes.flatMap((p) => p.articles).filter((a) => a.purchased);
  const gap = bought.reduce((sum, a) => sum + gapOf(a), 0);
  const percent =
    tree.total_ttc > 0 ? Math.round((100 * tree.actual_ttc) / tree.total_ttc) : 0;
  const scale = Math.max(1, ...tree.postes.map((p) => Math.max(p.subtotal_ttc, p.actual_ttc)));

  const alerts: Alert[] = [];
  for (const p of tree.postes) {
    for (const a of p.articles) {
      if (a.effective_source === "none") {
        alerts.push({ key: `u${a.id}`, tone: "bad", text: t("dashUnpriced", { name: a.name }) });
      }
    }
  }
  for (const a of bought) {
    const g = gapOf(a);
    if (g > 0) {
      alerts.push({ key: `o${a.id}`, tone: "warn", text: t("dashOver", { name: a.name, amount: money(g) }) });
    }
  }
  if (tree.purchased_count > 0) {
    for (const p of tree.postes) {
      if (p.articles.length > 0 && p.purchased_count === 0) {
        alerts.push({ key: `n${p.id}`, tone: "mute", text: t("dashNoPurchase", { name: p.name }) });
      }
    }
  }
  for (const a of bought) {
    const r = a.returned_quantity ?? 0;
    if (r > 0 && a.actual_ttc != null && a.quantity > 0) {
      const saved = (r * a.total_ttc) / a.quantity;
      alerts.push({
        key: `r${a.id}`,
        tone: "good",
        text: t("dashReturned", { name: a.name, qty: `${r}${a.unit ? ` ${a.unit}` : ""}`, amount: money(saved) }),
      });
    }
  }
  const shown = showAllAlerts ? alerts : alerts.slice(0, MAX_ALERTS);
  const tone = {
    bad: "bg-red-600",
    warn: "bg-amber-500",
    good: "bg-emerald-600",
    mute: "bg-muted-foreground",
  } as const;

  return (
    <div className="space-y-3" data-testid="chiffrage-totals">
      <div className="rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("estimatedTotal")}
            </p>
            <p className="text-2xl font-semibold tabular-nums">{money(tree.total_ht)}</p>
            <p className="text-xs text-muted-foreground">{t("excludingTax")}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-medium tabular-nums">{money(tree.total_ttc)}</p>
            <p className="text-xs text-muted-foreground">{t("includingTax")}</p>
          </div>
        </div>
        {tree.purchased_count > 0 ? (
          <div className="mt-4 space-y-2" data-testid="actual-summary">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
              <p>
                <span className="text-muted-foreground">{t("actualSpend")}:</span>{" "}
                <span className="font-semibold tabular-nums">{money(tree.actual_ttc)}</span>{" "}
                <span className="text-muted-foreground">
                  ({t("boughtOf", { done: tree.purchased_count, total: tree.article_count })})
                </span>
              </p>
              <p>
                <span className="text-muted-foreground">{t("dashGapLabel")}:</span>{" "}
                <span className={`font-semibold tabular-nums ${gapClass(gap)}`}>{signed(gap)}</span>
              </p>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.min(100, percent)}
            >
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, percent)}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">{t("dashSpentOf", { percent })}</p>
          </div>
        ) : null}
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

      {tree.postes.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-lg border bg-card p-4" data-testid="section-bars">
            <p className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">{t("dashBySection")}</p>
            <ul className="space-y-3">
              {tree.postes.map((p) => {
                const pg = p.articles.reduce((s, a) => s + gapOf(a), 0);
                return (
                  <li key={p.id} className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)_auto] items-center gap-3 text-sm">
                    {/* Two lines before cutting: "Mái (charpente, couverture,
                        isolation)" read as "Mái (charpent…" in one. */}
                    <span className="line-clamp-2 font-medium leading-snug" title={p.name}>{p.name}</span>
                    <span className="space-y-1">
                      <span className="block h-2 rounded-full bg-muted-foreground/25" style={{ width: `${(100 * p.subtotal_ttc) / scale}%` }} />
                      <span className="block h-2 rounded-full bg-primary" style={{ width: `${(100 * p.actual_ttc) / scale}%` }} />
                    </span>
                    <span className={`tabular-nums ${p.purchased_count ? gapClass(pg) : "text-muted-foreground"}`}>
                      {p.purchased_count ? signed(pg) : "—"}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 flex gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-full bg-muted-foreground/25" />{t("estimateShort")}</span>
              <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-full bg-primary" />{t("actualShort")}</span>
            </p>
          </div>

          <div className="rounded-lg border bg-card p-4" data-testid="attention-list">
            <p className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">
              {t("dashAttention")} ({alerts.length})
            </p>
            {shown.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("dashNothing")}</p>
            ) : (
              <ul className={`space-y-2 text-sm ${showAllAlerts ? "max-h-80 overflow-y-auto pr-1" : ""}`}>
                {shown.map((a) => (
                  <li key={a.key} className="flex items-start gap-2">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${tone[a.tone]}`} />
                    <span>{a.text}</span>
                  </li>
                ))}
              </ul>
            )}
            {/* The rest was a plain "and N more" that could not be opened. */}
            {alerts.length > MAX_ALERTS ? (
              <button
                type="button"
                onClick={() => setShowAllAlerts((v) => !v)}
                aria-expanded={showAllAlerts}
                className="mt-2 text-sm font-medium text-primary underline-offset-2 hover:underline"
                data-testid="attention-toggle"
              >
                {showAllAlerts ? t("dashShowLess") : t("dashMore", { count: alerts.length - MAX_ALERTS })}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
