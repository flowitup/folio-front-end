"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import type { FetchRefundableExpensesParams, RefundChannel } from "@/lib/api/billing/refundable-invoices";

/**
 * The refundable list's drill-down filters, kept in the URL so the dashboard
 * pills ("Remboursable · banque") and the expense page open the rows behind
 * their figure: `?project=<id>` and `?channel=company|bank`. Returns the API
 * params, a setter for the summary cards and a chip that clears them.
 */
export function useRefundableDrill() {
  const t = useTranslations("billing.refundable.drill");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rawChannel = searchParams.get("channel");
  const channel: RefundChannel | null = rawChannel === "company" || rawChannel === "bank" ? rawChannel : null;
  const projectId = searchParams.get("project") || null;

  const params = useMemo<FetchRefundableExpensesParams | undefined>(() => {
    if (!channel && !projectId) return undefined;
    return { ...(channel ? { channel } : {}), ...(projectId ? { projectId } : {}) };
  }, [channel, projectId]);

  const replace = useCallback(
    (update: (p: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams.toString());
      update(next);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const setChannel = useCallback(
    (value: RefundChannel | null) =>
      replace((p) => {
        if (value) p.set("channel", value);
        else p.delete("channel");
      }),
    [replace]
  );

  const chip =
    channel || projectId ? (
      <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="refundable-drill-chip">
        {channel && <span className="stamp">{t(channel)}</span>}
        {projectId && <span className="stamp">{t("project")}</span>}
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs underline"
          onClick={() =>
            replace((p) => {
              p.delete("channel");
              p.delete("project");
            })
          }
        >
          <X size={12} aria-hidden />
          {t("clear")}
        </button>
      </div>
    ) : null;

  return { channel, projectId, params, setChannel, chip };
}
