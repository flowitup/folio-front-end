"use client";

import { useTranslations } from "next-intl";
import { Sun } from "lucide-react";

// Static parity with the Sidebar "Today on site" footer widget — same
// figures/wording, no live weather feed wired up yet (see Sidebar.tsx).
const TEMP_C = 22;
const PLACE = "Le Lavandou";
const WORKERS_ON_SITE = 4;

/** Weather strip under the "This week" agenda (design Canvas 3a). */
export function OverviewWeatherCard() {
  const t = useTranslations("sidebar");

  return (
    <div className="folio-card flex items-center gap-3 px-[22px] py-4">
      <Sun size={26} style={{ color: "var(--accent)" }} aria-hidden="true" />
      <div className="font-display text-[22px] leading-none">
        {TEMP_C}°<span className="text-[12px]" style={{ color: "var(--muted)" }}> / clear</span>
      </div>
      <div className="ml-auto text-right text-[11.5px]" style={{ color: "var(--muted)" }}>
        {t("todayLocation", { place: PLACE, workers: WORKERS_ON_SITE })}
      </div>
    </div>
  );
}
