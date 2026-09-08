"use client";

/**
 * CompanySettingsSection — the Settings › Company self-service surface for
 * company admins (roles-permissions-redesign, D8/onboarding). Distinct from
 * `admin-companies-section.tsx` (platform-ops only, manages ANY company):
 * this renders only the companies the caller admins, and every mutation goes
 * through the company-scoped `require_company_role("admin")` backend gate
 * (accepts a plain company admin, not just `*:*`).
 *
 * Loads the caller's companies, defaults to the primary admin company (or
 * first), and lets the caller switch when they admin more than one. Each
 * sub-section (members, directory, join code) re-fetches on company switch.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Building2, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchMyCompaniesAction } from "@/app/[locale]/(app)/settings/_actions/companies-actions";
import type { MyCompany } from "@/types/companies";
// Reuses the existing ops join-code card (create/renew/revoke/copy) — same
// component the platform-ops company-manage page mounts, just handed this
// caller's own company id instead of an arbitrary one.
import { CompanyJoinCodeCard } from "@/components/companies/company-join-code-card";
import { CompanyMembersTable } from "@/components/companies/company-members-table";
import { CompanyDirectoryTable } from "@/components/companies/company-directory-table";

export function CompanySettingsSection() {
  const t = useTranslations("companySettings");

  const [adminCompanies, setAdminCompanies] = useState<MyCompany[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const fetchingRef = useRef(false);

  const load = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setIsLoading(true);
    try {
      const result = await fetchMyCompaniesAction();
      if (result.ok) {
        const admin = result.data.filter((c) => c.role === "admin");
        setAdminCompanies(admin);
        setSelectedId((prev) => {
          if (prev && admin.some((c) => c.id === prev)) return prev;
          return (admin.find((c) => c.is_primary) ?? admin[0])?.id ?? null;
        });
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
  // boot) so the members table and directory both refetch.
  const bumpRefresh = () => setRefreshToken((n) => n + 1);

  if (isLoading) {
    return (
      <section className="folio-card flex items-center justify-center p-12">
        <Loader2 size={20} className="animate-spin" style={{ color: "var(--muted)" }} />
      </section>
    );
  }

  if (adminCompanies.length === 0) {
    return (
      <section className="folio-card flex flex-col items-center gap-3 py-10 text-center">
        <Building2 size={32} style={{ color: "var(--muted)" }} />
        <p className="text-[13px]" style={{ color: "var(--muted)" }}>
          {t("notAdmin")}
        </p>
      </section>
    );
  }

  const selectedCompany = adminCompanies.find((c) => c.id === selectedId) ?? adminCompanies[0];

  return (
    <div className="space-y-5">
      {adminCompanies.length > 1 && (
        <div className="folio-card flex items-center gap-3 p-4">
          <label className="label-cap shrink-0" htmlFor="company-settings-picker">
            {t("companyPicker.label")}
          </label>
          <Select value={selectedCompany.id} onValueChange={setSelectedId}>
            <SelectTrigger id="company-settings-picker" className="h-8 w-full max-w-xs text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {adminCompanies.map((c) => (
                <SelectItem key={c.id} value={c.id} className="text-[13px]">
                  {c.legal_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <CompanyJoinCodeCard companyId={selectedCompany.id} initialCode={selectedCompany.join_code ?? null} />

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
    </div>
  );
}
