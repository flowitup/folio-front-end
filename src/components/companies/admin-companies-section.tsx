"use client";

/**
 * AdminCompaniesSection — Settings section visible only to admins (*:*).
 *
 * Shows the full company roster (sensitive fields in full, no masking for admins),
 * a "New company" CTA that opens CompanyCreateDialog, and per-row manage links.
 *
 * Data loading: fetches on mount via server action.
 * Refresh: refetch after create.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Plus, Building2, Loader2, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CompanyCreateDialog } from "@/components/companies/company-create-dialog";
import { fetchAllCompaniesAction } from "@/app/[locale]/(app)/settings/_actions/companies-actions";
import type { Company } from "@/types/companies";
import { formatDate } from "@/lib/utils/formatters";

export function AdminCompaniesSection() {
  const t = useTranslations("companies");
  const locale = useLocale();
  const router = useRouter();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const fetchingRef = useRef(false);

  const loadCompanies = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setIsLoading(true);
    try {
      const result = await fetchAllCompaniesAction();
      if (result.ok) {
        setCompanies(result.data.items);
        setTotal(result.data.total);
      }
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    void loadCompanies();
  }, [loadCompanies]);

  function handleManage(id: string) {
    router.push(`/${locale}/settings/companies/${id}`);
  }

  return (
    <section id="admin-companies" className="folio-card p-7">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-[22px] font-medium tracking-tight">
            {t("admin.title")}
          </h3>
          <p className="mt-0.5 text-[13px]" style={{ color: "var(--muted)" }}>
            {t("admin.description")}
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)} disabled={isLoading}>
          <Plus size={14} className="mr-1.5" />
          {t("admin.newCompany")}
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
            <p className="font-medium text-[14px]">{t("admin.empty.title")}</p>
            <p className="text-[13px] mt-1" style={{ color: "var(--muted)" }}>
              {t("admin.empty.description")}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
            <Plus size={13} className="mr-1.5" />
            {t("admin.newCompany")}
          </Button>
        </div>
      ) : (
        <>
          {/* Mobile card list */}
          <div className="flex flex-col gap-2 lg:hidden" data-testid="admin-companies-mobile">
            {companies.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleManage(c.id)}
                className="folio-card flex w-full items-start gap-3 p-4 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-[14px] truncate">{c.legal_name}</div>
                  {c.address && (
                    <div
                      className="text-[12px] truncate"
                      style={{ color: "var(--muted)" }}
                    >
                      {c.address}
                    </div>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px]">
                    <span className="num font-mono" style={{ color: "var(--muted)" }}>
                      {t("form.fields.siret.label")}: {c.siret ?? "—"}
                    </span>
                    <span className="num font-mono" style={{ color: "var(--muted)" }}>
                      {t("form.fields.tvaNumber.label")}: {c.tva_number ?? "—"}
                    </span>
                  </div>
                  <div
                    className="mt-0.5 num text-[12px]"
                    style={{ color: "var(--muted)" }}
                  >
                    {t("admin.table.createdAt")}: {formatDate(c.created_at)}
                  </div>
                </div>
                <Settings2
                  size={16}
                  className="mt-0.5 flex-shrink-0"
                  style={{ color: "var(--muted)" }}
                  aria-hidden
                />
              </button>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden lg:block" data-testid="admin-companies-desktop">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("form.fields.legalName.label")}</TableHead>
                <TableHead>{t("form.fields.siret.label")}</TableHead>
                <TableHead>{t("form.fields.tvaNumber.label")}</TableHead>
                <TableHead>{t("admin.table.createdAt")}</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="font-medium text-[13px]">{c.legal_name}</div>
                    <div
                      className="text-[12px] truncate max-w-[200px]"
                      style={{ color: "var(--muted)" }}
                      title={c.address}
                    >
                      {c.address}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="num font-mono text-[12px]">
                      {c.siret ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="num font-mono text-[12px]">
                      {c.tva_number ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className="num text-[12px]"
                      style={{ color: "var(--muted)" }}
                    >
                      {formatDate(c.created_at)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => handleManage(c.id)}
                      title={t("admin.manage.title")}
                    >
                      <Settings2 size={13} />
                      <span className="sr-only">{t("admin.manage.title")}</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>

          {total > companies.length && (
            <p
              className="mt-3 text-[12px] text-center"
              style={{ color: "var(--muted)" }}
            >
              {t("admin.table.showingOf", {
                shown: companies.length,
                total,
              })}
            </p>
          )}
        </>
      )}

      {/* Create dialog */}
      <CompanyCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => void loadCompanies()}
      />
    </section>
  );
}
