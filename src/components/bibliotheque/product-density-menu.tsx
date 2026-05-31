"use client";

/**
 * ProductDensityMenu — icon button that opens a small dropdown letting the
 * user pick how many product columns render per row on wide screens.
 *
 * Options are the wide-screen maximums (4 / 6 / 8). On smaller viewports the
 * grid auto-reduces (see COLUMN_CLASS_MAP in the page) regardless of choice.
 * Selection is session-only state held by the parent — not persisted.
 */

import { LayoutGrid } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/** Allowed wide-screen column counts, smallest → largest. */
export const COLUMN_OPTIONS = [4, 6, 8] as const;
export type ColumnCount = (typeof COLUMN_OPTIONS)[number];

/** Default density — densest layout per product decision. */
export const DEFAULT_COLUMNS: ColumnCount = 8;

interface ProductDensityMenuProps {
  value: ColumnCount;
  onChange: (next: ColumnCount) => void;
}

export function ProductDensityMenu({ value, onChange }: ProductDensityMenuProps) {
  const t = useTranslations("bibliotheque");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("columnsPerRow")}>
          <LayoutGrid className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {COLUMN_OPTIONS.map((count) => (
          <DropdownMenuItem
            key={count}
            onClick={() => onChange(count)}
            className={cn(value === count && "font-medium")}
          >
            <LayoutGrid className="mr-2 h-4 w-4" />
            {t("columnsCount", { count })}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
