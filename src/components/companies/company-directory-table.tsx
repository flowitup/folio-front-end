"use client";

/**
 * CompanyDirectoryTable — the company_persons directory (Phase 2 onboarding):
 * name, phone, pending/linked-account state, and assigned project count.
 * Read-only here — role and project assignment are managed from the members
 * table and each project's "Assign member" dialog respectively.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchCompanyDirectoryAction } from "@/app/[locale]/(app)/settings/_actions/company-settings-actions";
import type { CompanyDirectoryEntry } from "@/lib/api/companies-members";

interface Props {
  companyId: string;
}

export function CompanyDirectoryTable({ companyId }: Props) {
  const t = useTranslations("companySettings.directory");

  const [entries, setEntries] = useState<CompanyDirectoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const fetchingRef = useRef(false);

  const load = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setIsLoading(true);
    try {
      const result = await fetchCompanyDirectoryAction(companyId);
      if (result.ok) {
        setEntries(result.data);
      } else {
        // Surface the failure — an empty table otherwise reads as "no one
        // in the directory", not "couldn't load the directory".
        toast.error(result.error.message);
      }
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="folio-card p-7">
      <h3 className="font-display text-[20px] font-medium tracking-tight">{t("title")}</h3>
      <p className="mt-0.5 text-[13px]" style={{ color: "var(--muted)" }}>
        {t("description")}
      </p>

      <div className="ink-divider my-5" />

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={20} className="animate-spin" style={{ color: "var(--muted)" }} />
        </div>
      ) : entries.length === 0 ? (
        <p className="py-10 text-center text-[13px]" style={{ color: "var(--muted)" }}>
          {t("empty")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("col.name")}</TableHead>
                <TableHead>{t("col.phone")}</TableHead>
                <TableHead>{t("col.status")}</TableHead>
                <TableHead>{t("col.assignedProjects")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.person_id}>
                  <TableCell className="text-[13px] font-medium">{entry.name}</TableCell>
                  <TableCell className="num text-[13px]" style={{ color: "var(--muted)" }}>
                    {entry.phone}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {entry.pending && (
                        <span
                          className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                          style={{ background: "var(--surface-2, #eee)", color: "var(--muted)" }}
                        >
                          {t("pending")}
                        </span>
                      )}
                      {entry.linked_user_id && (
                        <span
                          className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                          style={{ background: "var(--accent)", color: "white" }}
                        >
                          {t("linked")}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="num text-[13px]" style={{ color: "var(--muted)" }}>
                    {entry.assigned_project_ids.length}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
