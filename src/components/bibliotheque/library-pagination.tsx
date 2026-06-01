"use client";

/**
 * LibraryPagination — prev/next arrows plus an editable page-number input that
 * lets the user jump directly to any page.
 *
 * The input mirrors the current page; typing a number and pressing Enter (or
 * blurring) commits the jump, clamped to [1, totalPages]. Non-numeric / empty
 * input resets to the current page. Arrows step by one and disable at bounds.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Input } from "@/components/ui/input";

interface LibraryPaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (next: number) => void;
}

export function LibraryPagination({
  page,
  totalPages,
  onPageChange,
}: LibraryPaginationProps) {
  const t = useTranslations("bibliotheque");

  // Local draft of the input — kept in sync with the committed page so arrow
  // clicks and external page changes update the field too. Synced by adjusting
  // derived state during render (no effect) per React guidance.
  const [inputValue, setInputValue] = useState(String(page));
  const [lastPage, setLastPage] = useState(page);
  if (page !== lastPage) {
    setLastPage(page);
    setInputValue(String(page));
  }

  const commit = () => {
    const parsed = parseInt(inputValue, 10);
    if (Number.isNaN(parsed)) {
      setInputValue(String(page)); // revert invalid entry
      return;
    }
    const clamped = Math.min(Math.max(parsed, 1), totalPages);
    setInputValue(String(clamped));
    if (clamped !== page) onPageChange(clamped);
  };

  return (
    <div className="mt-8 flex items-center justify-center gap-2">
      <button
        type="button"
        className="btn btn-ghost"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        aria-label={t("previousPage")}
      >
        <ChevronLeft size={16} />
      </button>

      <div
        className="flex items-center gap-1.5 text-[13px]"
        style={{ color: "var(--muted)" }}
      >
        <span>{t("page")}</span>
        <Input
          type="text"
          inputMode="numeric"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value.replace(/[^0-9]/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
          onBlur={commit}
          aria-label={t("goToPage")}
          className="num h-8 w-14 text-center"
        />
        <span className="num">/ {totalPages}</span>
      </div>

      <button
        type="button"
        className="btn btn-ghost"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        aria-label={t("nextPage")}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
