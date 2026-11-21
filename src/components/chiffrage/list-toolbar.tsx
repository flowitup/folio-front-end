"use client";

/**
 * Search, status filter and fold/unfold-all above a long chiffrage, shared by
 * the estimate and the shopping list.
 */

import { useTranslations } from "next-intl";
import { ChevronsDownUp, ChevronsUpDown, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ListFilter, ListStatus } from "@/components/chiffrage/list-filter";

interface Props {
  filter: ListFilter;
  onChange: (f: ListFilter) => void;
  /** Lines shown / lines in the chiffrage. */
  shown: number;
  total: number;
  onCollapseAll: () => void;
  onExpandAll: () => void;
}

const STATUSES: ListStatus[] = ["all", "toBuy", "bought", "unpriced"];

export function ListToolbar({ filter, onChange, shown, total, onCollapseAll, onExpandAll }: Props) {
  const t = useTranslations("chiffrage");
  const label: Record<ListStatus, string> = {
    all: t("filterAll"),
    toBuy: t("filterToBuy"),
    bought: t("filterBought"),
    unpriced: t("filterUnpriced"),
  };
  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden" data-testid="list-toolbar">
      <div className="relative min-w-[14rem] flex-1 sm:max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          inputMode="search"
          value={filter.query}
          onChange={(e) => onChange({ ...filter, query: e.target.value })}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          className="h-9 pl-8 pr-8"
        />
        {filter.query ? (
          <button
            type="button"
            onClick={() => onChange({ ...filter, query: "" })}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
            aria-label={t("clearSearch")}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      <div className="inline-flex flex-wrap rounded-md border p-0.5" role="group" aria-label={t("filterLabel")}>
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={filter.status === s}
            onClick={() => onChange({ ...filter, status: s })}
            className={`rounded px-2.5 py-1 text-sm ${
              filter.status === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {label[s]}
          </button>
        ))}
      </div>
      <span className="text-sm tabular-nums text-muted-foreground" data-testid="list-count">
        {t("linesShown", { shown, total })}
      </span>
      <div className="ml-auto flex gap-1">
        <Button type="button" variant="ghost" size="sm" onClick={onCollapseAll}>
          <ChevronsDownUp className="mr-1 h-4 w-4" />
          {t("collapseAll")}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onExpandAll}>
          <ChevronsUpDown className="mr-1 h-4 w-4" />
          {t("expandAll")}
        </Button>
      </div>
    </div>
  );
}
