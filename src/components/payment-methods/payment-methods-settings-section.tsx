"use client";

/**
 * PaymentMethodsSettingsSection — the Settings → Payment methods tab.
 *
 * Payment methods are company-scoped, so this wrapper resolves *which* company
 * to manage before delegating to the existing PaymentMethodsSection (the same
 * component the admin company-manage page mounts):
 *
 *   1. Load the caller's attached companies.
 *   2. Default to the primary company, else the first one.
 *   3. Render a company picker only when the caller has more than one.
 *
 * Permissions: the backend requires the global admin permission ("*:*") for
 * every create/update/delete, while listing is open to any company member.
 * Non-admins therefore get a read-only inventory instead of controls that
 * would always fail with 403.
 *
 * PaymentMethodsSection seeds its local state from `initial`, so it is keyed by
 * company id to force a remount when the selection changes.
 */

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Building2, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { PaymentMethodsSection } from "@/app/[locale]/(app)/settings/companies/[id]/_components/payment-methods-section";
import { listPaymentMethodsAction } from "@/app/[locale]/(app)/settings/companies/[id]/_actions/payment-methods-actions";
import { fetchMyCompaniesAction } from "@/app/[locale]/(app)/settings/_actions/companies-actions";
import type { PaymentMethod } from "@/lib/api/payment-methods-api";
import type { MyCompany } from "@/types/companies";

type LoadState = "loading" | "ready" | "error";

/**
 * Outcome of the last methods fetch, tagged with the company it belongs to.
 * Keeping the id on the value lets the render derive "loading" by comparing
 * against the current selection instead of setting state inside the effect.
 */
type MethodsResult =
  | { companyId: string; data: PaymentMethod[] }
  | { companyId: string; error: true };

export function PaymentMethodsSettingsSection() {
  const t = useTranslations("paymentMethods");
  const { user } = useAuth();
  const canManage = (user?.permissions ?? []).includes("*:*");

  const [companies, setCompanies] = useState<MyCompany[]>([]);
  const [companiesState, setCompaniesState] = useState<LoadState>("loading");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [methodsResult, setMethodsResult] = useState<MethodsResult | null>(null);

  // Guard against overlapping company fetches (mount + remount in strict mode).
  const loadingCompaniesRef = useRef(false);

  // ---- Load the caller's companies once, then pick the default ----
  useEffect(() => {
    if (loadingCompaniesRef.current) return;
    loadingCompaniesRef.current = true;
    let cancelled = false;

    void (async () => {
      const result = await fetchMyCompaniesAction();
      if (cancelled) return;
      if (!result.ok) {
        setCompaniesState("error");
        return;
      }
      setCompanies(result.data);
      const preferred = result.data.find((c) => c.is_primary) ?? result.data[0];
      setSelectedId(preferred?.id ?? null);
      setCompaniesState("ready");
    })().finally(() => {
      loadingCompaniesRef.current = false;
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // ---- Load the selected company's methods (refetched on every switch) ----
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    void (async () => {
      const result = await listPaymentMethodsAction(selectedId);
      if (cancelled) return;
      setMethodsResult(
        result.ok
          ? { companyId: selectedId, data: result.data }
          : { companyId: selectedId, error: true }
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  // A result for a different company means the switch is still in flight.
  const methodsForSelection =
    methodsResult && methodsResult.companyId === selectedId ? methodsResult : null;

  // ---- Render ----

  if (companiesState === "loading") {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 size={20} className="animate-spin" style={{ color: "var(--muted)" }} />
      </div>
    );
  }

  if (companiesState === "error") {
    return (
      <p className="py-10 text-center text-[13px]" style={{ color: "var(--muted)" }}>
        {t("loadError")}
      </p>
    );
  }

  if (companies.length === 0 || !selectedId) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <Building2 size={32} style={{ color: "var(--muted)" }} />
        <p className="text-[13px]" style={{ color: "var(--muted)" }}>
          {t("noCompanies")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {companies.length > 1 && (
        <div className="flex items-center gap-3">
          <label className="label-cap shrink-0" htmlFor="payment-methods-company">
            {t("companyLabel")}
          </label>
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger
              id="payment-methods-company"
              className="h-8 w-full max-w-xs text-[13px]"
              aria-label={t("companyLabel")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id} className="text-[13px]">
                  {c.legal_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {methodsForSelection === null && (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={20} className="animate-spin" style={{ color: "var(--muted)" }} />
        </div>
      )}

      {methodsForSelection && "error" in methodsForSelection && (
        <p className="py-10 text-center text-[13px]" style={{ color: "var(--muted)" }}>
          {t("loadError")}
        </p>
      )}

      {methodsForSelection && "data" in methodsForSelection && (
        <PaymentMethodsSection
          key={selectedId}
          initial={methodsForSelection.data}
          companyId={selectedId}
          readOnly={!canManage}
          descriptionOverride={canManage ? undefined : t("readOnlyNote")}
        />
      )}
    </div>
  );
}
