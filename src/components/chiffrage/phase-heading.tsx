"use client";

/**
 * A stage of works (giai đoạn) inside a poste: its name, how many of its
 * lines are bought, what it is estimated at and what was really spent. Click
 * to fold it.
 *
 * The figures come straight from the backend's phase_subtotals, like the room
 * headings, so the stages always add up to the poste total shown above.
 */

import { useTranslations } from "next-intl";
import { ChevronDown, ChevronRight, Layers } from "lucide-react";

import { money } from "@/components/chiffrage/format";
import type { ChiffragePhaseSubtotal } from "@/lib/api/chiffrage";

interface Props {
  /** null: the lines not assigned to a stage. */
  name: string | null;
  /** 1-based rank in the poste ("GĐ1"); null for the unassigned lines. */
  rank: number | null;
  subtotal: ChiffragePhaseSubtotal | undefined;
  /** "ht" in the estimate, "ttc" in the shopping list (compared with the spend). */
  amount: "ht" | "ttc";
  collapsed: boolean;
  onToggle: () => void;
}

export function PhaseHeading({ name, rank, subtotal, amount, collapsed, onToggle }: Props) {
  const t = useTranslations("chiffrage");
  const count = subtotal?.article_count ?? 0;
  const bought = subtotal?.purchased_count ?? 0;
  const done = count > 0 && bought === count;
  const estimate = subtotal ? (amount === "ht" ? subtotal.subtotal_ht : subtotal.subtotal_ttc) : 0;
  const actual = subtotal?.actual_ttc ?? 0;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      className="flex w-full flex-wrap items-center gap-x-2 gap-y-0.5 border-b border-t bg-primary/5 px-3 py-2 text-left first:border-t-0 hover:bg-primary/10"
      data-testid="phase-heading"
    >
      {collapsed ? (
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      ) : (
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      <Layers className="h-4 w-4 shrink-0 text-primary" />
      {rank !== null ? (
        <span className="shrink-0 rounded bg-primary px-1.5 py-0.5 text-xs font-semibold text-primary-foreground">
          {t("stageChip", { n: rank })}
        </span>
      ) : null}
      <span className="min-w-0 truncate text-sm font-semibold">{name ?? t("noPhase")}</span>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-xs tabular-nums ${
          done ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-muted text-muted-foreground"
        }`}
      >
        {t("boughtOf", { done: bought, total: count })}
      </span>
      <span className="ml-auto shrink-0 text-right text-xs tabular-nums">
        <span className="font-medium text-foreground">
          {money(estimate)}
          {amount === "ttc" ? ` ${t("ttcShort")}` : ""}
        </span>
        {actual > 0 ? (
          <span className="ml-2 text-muted-foreground" data-testid="phase-actual">
            {t("actualShort")} {money(actual)}
          </span>
        ) : null}
      </span>
    </button>
  );
}
