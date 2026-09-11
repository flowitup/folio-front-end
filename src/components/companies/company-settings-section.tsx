"use client";

/**
 * CompanySettingsSection — the single Settings › Company surface.
 *
 * Folds together what used to be two separate settings tabs:
 *  - "My companies": the caller's attachments — identity card with masked
 *    SIRET / TVA / IBAN / BIC, primary toggle, detach, attach-by-invite-token;
 *  - "Company": the company-admin self-service tools — join code, members
 *    (roles, D8 grants, add-by-phone, import) and directory.
 *
 * One picker at the top governs both halves, so a caller who admins the single
 * company they belong to — the common case — sees that company described once
 * instead of twice under two different tabs.
 *
 * The admin half renders only when the caller's role in the SELECTED company is
 * "admin"; nothing behind it would do anything but 403 for a manager or member,
 * and every mutation still goes through the company-scoped
 * `require_company_role("admin")` backend gate. `admin-companies-section.tsx`
 * stays separate: it is platform-ops only and manages ANY company.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Building2, Loader2, Plus, RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MyCompanyCard } from "@/components/companies/my-company-card";
import { RedeemInviteTokenDialog } from "@/components/companies/redeem-invite-token-dialog";
// Reuses the existing ops join-code card (create/renew/revoke/copy) — same
// component the platform-ops company-manage page mounts, just handed this
// caller's own company id instead of an arbitrary one.
import { CompanyJoinCodeCard } from "@/components/companies/company-join-code-card";
import { CompanyMembersTable } from "@/components/companies/company-members-table";
import { CompanyDirectoryTable } from "@/components/companies/company-directory-table";
import { fetchMyCompaniesAction } from "@/app/[locale]/(app)/settings/_actions/companies-actions";
import type { CompanyRole, MyCompany } from "@/types/companies";

/** Role chip copy — reuses the labels already shown in the members table. */
const ROLE_LABEL_KEY: Record<CompanyRole, string> = {
  admin: "members.roleAdmin",
  manager: "members.roleManager",
  member: "members.roleMember",
};

export function CompanySettingsSection() {
  const t = useTranslations("companySettings");
  const tc = useTranslations("companies");
  const tSettings = useTranslations("settings");

  const [companies, setCompanies] = useState<MyCompany[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  const fetchingRef = useRef(false);

  const load = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setIsLoading(true);
    try {
      const result = await fetchMyCompaniesAction();
      if (result.ok) {
        setLoadFailed(false);
        setCompanies(result.data);
        setSelectedId((prev) => {
          if (prev && result.data.some((c) => c.id === prev)) return prev;
          return (result.data.find((c) => c.is_primary) ?? result.data[0])?.id ?? null;
        });
      } else {
        // Keep whatever list we already had — but remember the failure, so a
        // first load that errors shows "could not load" instead of claiming
        // the caller belongs to no company and pushing an invite-token CTA.
        setLoadFailed(true);
      }
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Bump after member-list-affecting mutations (role change, add, import,
  // boot) so the members table and the directory both refetch.
  const bumpRefresh = () => setRefreshToken((n) => n + 1);

  // "Import from company" only makes sense between companies the caller
  // administers, so the source list stays admin-scoped even though the picker
  // above now lists every attachment.
  const adminCompanies = useMemo(
    () => companies.filter((c) => c.role === "admin"),
    [companies]
  );

  if (isLoading) {
    return (
      <section className="folio-card flex items-center justify-center p-12">
        <Loader2 size={20} className="animate-spin" style={{ color: "var(--muted)" }} />
      </section>
    );
  }

  const selectedCompany = companies.find((c) => c.id === selectedId) ?? companies[0];
  const isAdminOfSelected = selectedCompany?.role === "admin";

  return (
    <div className="space-y-5">
      <section className="folio-card p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-[22px] font-medium tracking-tight">
              {tSettings("company.title")}
            </h3>
            <p className="mt-0.5 text-[13px]" style={{ color: "var(--muted)" }}>
              {t("description")}
            </p>
          </div>
          <Button size="sm" onClick={() => setRedeemOpen(true)}>
            <Plus size={14} className="mr-1.5" />
            {tc("my.addCta")}
          </Button>
        </div>

        <div className="ink-divider my-5" />

        {!selectedCompany && loadFailed ? (
          // A failed fetch must not read as "you belong to no company".
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <TriangleAlert size={28} style={{ color: "var(--muted)" }} />
            <p className="text-[13px]" style={{ color: "var(--muted)" }}>
              {t("loadError")}
            </p>
            <Button size="sm" variant="outline" onClick={() => void load()}>
              <RefreshCw size={13} className="mr-1.5" />
              {t("retry")}
            </Button>
          </div>
        ) : !selectedCompany ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Building2 size={28} style={{ color: "var(--muted)" }} />
            <div>
              <p className="text-[14px] font-medium">{tc("my.empty.title")}</p>
              <p className="mt-1 text-[13px]" style={{ color: "var(--muted)" }}>
                {tc("my.empty.cta")}
              </p>
            </div>
          </div>
        ) : (
          /*
            Which company everything below is about. The picker appears only
            when there is a choice to make — with a single attachment the card
            underneath already names it, so repeating the name here would say
            the same thing twice. The role chip stays either way: it is what
            explains the absence of the admin half to a member.
          */
          <div className="flex flex-wrap items-center gap-3">
            {companies.length > 1 && (
              <>
                <label className="label-cap shrink-0" htmlFor="company-settings-picker">
                  {t("companyPicker.label")}
                </label>
                <Select value={selectedCompany.id} onValueChange={setSelectedId}>
                  <SelectTrigger
                    id="company-settings-picker"
                    className="h-8 w-full max-w-xs text-[13px]"
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
              </>
            )}
            <span
              className="shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium"
              style={{ borderColor: "var(--line)", color: "var(--muted)" }}
            >
              {t(ROLE_LABEL_KEY[selectedCompany.role])}
            </span>
          </div>
        )}
      </section>

      {selectedCompany && (
        <>
          {/* Attachment half — visible whatever the caller's role is. */}
          <MyCompanyCard company={selectedCompany} onMutated={load} />

          {/* Admin half — company-admin self-service for the selected company.
              Every child is keyed on the company id: they all hold fetched or
              seeded state (the join code above all, which is a credential), so
              switching companies must remount them rather than leave one
              company's data labelled with another's. */}
          {isAdminOfSelected && (
            <>
              <CompanyJoinCodeCard
                key={`join-code-${selectedCompany.id}`}
                companyId={selectedCompany.id}
                initialCode={selectedCompany.join_code ?? null}
              />

              <CompanyMembersTable
                key={`members-${selectedCompany.id}-${refreshToken}`}
                companyId={selectedCompany.id}
                adminOfMultiple={adminCompanies.length > 1}
                sourceCompanies={adminCompanies.filter((c) => c.id !== selectedCompany.id)}
                onMutated={bumpRefresh}
              />

              <CompanyDirectoryTable
                key={`directory-${selectedCompany.id}-${refreshToken}`}
                companyId={selectedCompany.id}
              />
            </>
          )}
        </>
      )}

      <RedeemInviteTokenDialog
        open={redeemOpen}
        onOpenChange={setRedeemOpen}
        onAttached={() => void load()}
      />
    </div>
  );
}
