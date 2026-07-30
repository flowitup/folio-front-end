"use client";

/**
 * Command bar for the Expense page: search, type chips (with counts), and a
 * month-range picker. TagFilterSelect + Export button are passed as children
 * so this component stays presentation-only and doesn't own their state.
 *
 * All filtering it drives is client-side (see `src/lib/invoices/expense-filters.ts`):
 * chip counts reflect the search+range-filtered list, not the type filter,
 * so switching chips never changes the numbers shown on the other chips.
 */

import type { ReactNode } from "react";
import { Search, X } from "lucide-react";
import type { ExpenseTabType } from "@/lib/invoices/expense-filters";

export interface ExpenseChip {
  key: ExpenseTabType;
  label: string;
  count: number;
  active: boolean;
}

interface ExpenseCommandBarProps {
  q: string;
  onQChange: (q: string) => void;
  searchPlaceholder: string;
  clearSearchLabel: string;
  chips: ExpenseChip[];
  onChipSelect: (key: ExpenseTabType) => void;
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  onClearRange: () => void;
  fromLabel: string;
  toLabel: string;
  clearRangeLabel: string;
  /** TagFilterSelect + Export button, rendered at the end of the bar. */
  children?: ReactNode;
}

const MONTH_INPUT_STYLE = {
  background: "var(--paper-2)",
  border: "1px solid var(--line-2)",
  color: "var(--ink-2)",
} as const;

export function ExpenseCommandBar({
  q,
  onQChange,
  searchPlaceholder,
  clearSearchLabel,
  chips,
  onChipSelect,
  from,
  to,
  onFromChange,
  onToChange,
  onClearRange,
  fromLabel,
  toLabel,
  clearRangeLabel,
  children,
}: ExpenseCommandBarProps) {
  const hasQ = q.length > 0;
  const hasRange = Boolean(from || to);

  return (
    <div className="flex flex-wrap items-center gap-3" data-testid="expense-command-bar">
      <div
        className="flex h-9 min-w-[250px] items-center gap-2 rounded-[10px] border bg-white px-3 focus-within:border-[var(--ink)]"
        style={{ borderColor: "var(--line-2)", color: "var(--muted)" }}
      >
        <Search size={14} className="flex-none" aria-hidden="true" />
        <input
          value={q}
          onChange={(e) => onQChange(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="min-w-0 flex-1 border-none bg-transparent text-[13px] outline-none"
          style={{ color: "var(--ink)" }}
        />
        {hasQ && (
          <button
            type="button"
            onClick={() => onQChange("")}
            aria-label={clearSearchLabel}
            className="inline-flex flex-none p-0.5"
            style={{ color: "var(--muted)" }}
          >
            <X size={12} />
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-wrap gap-[7px]" data-testid="expense-type-chips">
        {chips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => onChipSelect(chip.key)}
            aria-pressed={chip.active}
            className="inline-flex h-8 items-center gap-[7px] rounded-full px-3 text-[12.5px] font-medium"
            style={
              chip.active
                ? { background: "var(--ink)", color: "var(--paper)", border: "1px solid var(--ink)" }
                : { background: "var(--paper-2)", color: "var(--ink-2)", border: "1px solid var(--line-2)" }
            }
          >
            {chip.label} <span className="num" style={{ fontSize: 11, opacity: 0.65 }}>{chip.count}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        <input
          type="month"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
          aria-label={fromLabel}
          className="h-8 cursor-pointer rounded-[10px] px-2 text-[12px] font-medium"
          style={MONTH_INPUT_STYLE}
        />
        <span style={{ color: "var(--muted-2)", fontSize: 12 }} aria-hidden="true">→</span>
        <input
          type="month"
          value={to}
          onChange={(e) => onToChange(e.target.value)}
          aria-label={toLabel}
          className="h-8 cursor-pointer rounded-[10px] px-2 text-[12px] font-medium"
          style={MONTH_INPUT_STYLE}
        />
        {hasRange && (
          <button
            type="button"
            onClick={onClearRange}
            className="p-1 text-[12px]"
            style={{ color: "var(--muted)" }}
          >
            {clearRangeLabel}
          </button>
        )}
      </div>

      {children}
    </div>
  );
}
