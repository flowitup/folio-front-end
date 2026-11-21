"use client";

/**
 * A "[Group]" divider inside a section (taken from the article notes), with
 * how many of its lines are bought and what it costs. Click to fold it.
 */

import { useTranslations } from "next-intl";
import { ChevronDown, ChevronRight } from "lucide-react";

import { money } from "@/components/chiffrage/format";

interface Props {
  name: string;
  count: number;
  bought: number;
  amount: number;
  /** Label next to the amount, e.g. "gồm VAT"; omitted for HT. */
  amountSuffix?: string;
  collapsed: boolean;
  onToggle: () => void;
}

export function GroupHeading({ name, count, bought, amount, amountSuffix, collapsed, onToggle }: Props) {
  const t = useTranslations("chiffrage");
  const done = count > 0 && bought === count;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      className="flex w-full items-center gap-2 border-b bg-muted/20 px-3 py-1.5 text-left hover:bg-muted/40"
      data-testid="group-heading"
    >
      {collapsed ? (
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      ) : (
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}
      <span className="truncate text-sm font-medium">{name}</span>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-xs tabular-nums ${
          done ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-muted text-muted-foreground"
        }`}
      >
        {t("boughtOf", { done: bought, total: count })}
      </span>
      <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
        {money(amount)}
        {amountSuffix ? ` ${amountSuffix}` : ""}
      </span>
    </button>
  );
}
