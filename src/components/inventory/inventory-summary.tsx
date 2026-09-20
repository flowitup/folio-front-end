"use client";

/**
 * InventorySummary — the unit totals in five tiles: everything, working,
 * damaged, at a warehouse, on a site. Units, not rows: a row of three drills
 * counts three.
 */

import { useTranslations } from "next-intl";
import type { InventorySummary as Summary } from "@/lib/inventory/inventory";

function Tile({
  label,
  value,
  tone = "ink",
  testId,
}: {
  label: string;
  value: number;
  tone?: "ink" | "positive" | "negative";
  testId: string;
}) {
  const color = tone === "positive" ? "var(--positive)" : tone === "negative" ? "var(--negative)" : "var(--ink)";
  return (
    <div className="folio-card px-4 py-3">
      <div className="label-cap">{label}</div>
      <div className="font-display num mt-1 text-[24px] leading-none" style={{ color }} data-testid={testId}>
        {value}
      </div>
    </div>
  );
}

export function InventorySummaryTiles({ summary }: { summary: Summary }) {
  const t = useTranslations("inventory");
  return (
    <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <Tile label={t("summary.total")} value={summary.quantity} testId="inventory-summary-total" />
      <Tile label={t("condition.working")} value={summary.working} tone="positive" testId="inventory-summary-working" />
      <Tile
        label={t("condition.damaged")}
        value={summary.damaged}
        tone={summary.damaged > 0 ? "negative" : "ink"}
        testId="inventory-summary-damaged"
      />
      <Tile label={t("location.warehouse")} value={summary.inWarehouse} testId="inventory-summary-warehouse" />
      <Tile label={t("location.site")} value={summary.onSite} testId="inventory-summary-site" />
    </div>
  );
}
