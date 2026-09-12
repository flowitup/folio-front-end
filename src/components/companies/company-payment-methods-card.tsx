"use client";

/**
 * CompanyPaymentMethodsCard — the payment-methods half of Settings › Company.
 *
 * A sibling of CompanyJoinCodeCard / CompanyMembersTable / CompanyDirectoryTable:
 * the parent decides *which* company the caller is looking at, this component
 * owns the fetch for that company and renders the shared PaymentMethodsSection
 * (the same component the platform-ops company-manage page mounts).
 *
 * The parent mounts it only for an admin of the selected company, which matches
 * the backend gate — CreatePaymentMethodUseCase and friends accept platform ops
 * OR an admin of this company — so every control shown here can actually
 * succeed. That is why there is no read-only variant: a caller who may not
 * mutate never reaches this card.
 *
 * PaymentMethodsSection seeds its local state from `initial` once and never
 * re-reads it, so the parent keys this card by company id: a company switch
 * remounts both, and this card always starts from no result. Reusing it in
 * place across company switches is NOT supported — going A → B → A would
 * re-show A's first result (still tagged "A") while the third fetch is in
 * flight, and the section would then ignore the fresher list. The fetch is
 * still keyed on `companyId` so a dropped key degrades to a refetch rather
 * than to another company's data.
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PaymentMethodsSection } from "@/app/[locale]/(app)/settings/companies/[id]/_components/payment-methods-section";
import { listPaymentMethodsAction } from "@/app/[locale]/(app)/settings/companies/[id]/_actions/payment-methods-actions";
import type { PaymentMethod } from "@/lib/api/payment-methods-api";

interface CompanyPaymentMethodsCardProps {
  companyId: string;
}

/**
 * Outcome of the last fetch, tagged with the company it belongs to. Keeping the
 * id on the value lets the render derive "still loading" by comparing it with
 * the current prop, instead of resetting state from inside the effect.
 */
type MethodsResult =
  | { companyId: string; methods: PaymentMethod[] }
  | { companyId: string; error: true };

export function CompanyPaymentMethodsCard({ companyId }: CompanyPaymentMethodsCardProps) {
  const t = useTranslations("paymentMethods");
  const [result, setResult] = useState<MethodsResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await listPaymentMethodsAction(companyId);
      if (cancelled) return;
      setResult(
        res.ok ? { companyId, methods: res.data } : { companyId, error: true }
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  // A result for a different company means this company's fetch is still out.
  const current = result && result.companyId === companyId ? result : null;

  if (current && "methods" in current) {
    return <PaymentMethodsSection initial={current.methods} companyId={companyId} />;
  }

  // Loading and error keep the loaded section's frame and title, so the card
  // holds its place in the stack instead of appearing once the fetch lands.
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[16px]">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {current === null ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 size={20} className="animate-spin" style={{ color: "var(--muted)" }} />
          </div>
        ) : (
          <p className="py-6 text-center text-[13px]" style={{ color: "var(--muted)" }}>
            {t("loadError")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
