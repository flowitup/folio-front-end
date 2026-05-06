"use client";

/**
 * MyCompaniesSection — Settings section visible to all authenticated users.
 *
 * Loads the current user's attached companies on mount, renders a MyCompanyCard
 * per entry, and provides an "Add company" CTA that opens RedeemInviteTokenDialog.
 *
 * Refresh strategy: re-fetch from server action after any mutation (attach /
 * setPrimary / detach). No optimistic updates — correctness over speed here.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Building2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MyCompanyCard } from "@/components/companies/my-company-card";
import { RedeemInviteTokenDialog } from "@/components/companies/redeem-invite-token-dialog";
import { fetchMyCompaniesAction } from "@/app/[locale]/(app)/settings/_actions/companies-actions";
import type { MyCompany } from "@/types/companies";

export function MyCompaniesSection() {
  const t = useTranslations("companies");

  const [companies, setCompanies] = useState<MyCompany[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [redeemOpen, setRedeemOpen] = useState(false);

  // Prevent concurrent fetches
  const fetchingRef = useRef(false);

  const loadCompanies = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setIsLoading(true);
    try {
      const result = await fetchMyCompaniesAction();
      if (result.ok) {
        setCompanies(result.data);
      }
      // On error: silently keep stale list — user sees what they had before.
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    void loadCompanies();
  }, [loadCompanies]);

  return (
    <section id="my-companies" className="folio-card p-7">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-[22px] font-medium tracking-tight">
            {t("my.title")}
          </h3>
          <p className="mt-0.5 text-[13px]" style={{ color: "var(--muted)" }}>
            {t("my.description")}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setRedeemOpen(true)}
          disabled={isLoading}
        >
          <Plus size={14} className="mr-1.5" />
          {t("my.addCta")}
        </Button>
      </div>

      <div className="ink-divider my-5" />

      {/* Body */}
      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2
            size={20}
            className="animate-spin"
            style={{ color: "var(--muted)" }}
          />
        </div>
      ) : companies.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <Building2 size={32} style={{ color: "var(--muted)" }} />
          <div>
            <p className="font-medium text-[14px]">{t("my.empty.title")}</p>
            <p className="text-[13px] mt-1" style={{ color: "var(--muted)" }}>
              {t("my.empty.cta")}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setRedeemOpen(true)}
          >
            <Plus size={13} className="mr-1.5" />
            {t("my.addCta")}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {companies.map((company) => (
            <MyCompanyCard
              key={company.id}
              company={company}
              onMutated={loadCompanies}
            />
          ))}
        </div>
      )}

      {/* Redeem invite token dialog */}
      <RedeemInviteTokenDialog
        open={redeemOpen}
        onOpenChange={setRedeemOpen}
        onAttached={() => void loadCompanies()}
      />
    </section>
  );
}
