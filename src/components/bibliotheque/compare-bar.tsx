"use client";

/**
 * CompareBar — floating action bar shown while compare mode is active and at
 * least one product is selected. Surfaces the running selection count, a Clear
 * action, and a Compare action enabled once ≥2 products are picked.
 *
 * Rendered conditionally by the page; this component assumes it should be
 * visible whenever it is mounted.
 */

import { useTranslations } from "next-intl";
import { Scale, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CompareBarProps {
  count: number;
  canCompare: boolean;
  onClear: () => void;
  onCompare: () => void;
}

export function CompareBar({ count, canCompare, onClear, onCompare }: CompareBarProps) {
  const t = useTranslations("bibliotheque");

  return (
    <div
      className="fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full border px-4 py-2 shadow-lg"
      style={{ background: "var(--paper)", borderColor: "var(--line)" }}
      role="region"
      aria-label={t("compare")}
    >
      <span className="text-[13px] font-medium">{t("compareSelected", { count })}</span>
      <Button variant="ghost" size="sm" className="gap-1" onClick={onClear}>
        <X className="h-3.5 w-3.5" />
        {t("clearSelection")}
      </Button>
      <Button size="sm" className="gap-1.5" disabled={!canCompare} onClick={onCompare}>
        <Scale className="h-4 w-4" />
        {t("compareAction", { count })}
      </Button>
    </div>
  );
}
