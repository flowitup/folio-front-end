"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { fetchFundsReleasedTotal } from "@/lib/api/invoice-api";

interface FundsReleasedCardProps {
  projectId: string | null;
}

export function FundsReleasedCard({ projectId }: FundsReleasedCardProps) {
  const t = useTranslations("dashboard");
  const [total, setTotal] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const r = await fetchFundsReleasedTotal(projectId);
        if (!cancelled) setTotal(r.total);
      } catch {
        if (!cancelled) setTotal(0);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [projectId]);

  const formatEUR = (n: number) =>
    new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <div className="folio-card p-5" style={{ minHeight: 100 }}>
      <div className="label-cap">{t("fundsReleased")}</div>
      {isLoading ? (
        <div className="mt-3 flex items-center">
          <Loader2 size={16} className="animate-spin" style={{ color: "var(--muted)" }} />
        </div>
      ) : (
        <>
          <div
            className="font-display num mt-2 text-[28px] font-medium leading-none"
            style={{ color: "var(--positive)" }}
          >
            {formatEUR(total)}
          </div>
          <div className="num mt-2 text-[11px]" style={{ color: "var(--muted)" }}>
            {t("fundsReleasedDesc")}
          </div>
        </>
      )}
    </div>
  );
}
