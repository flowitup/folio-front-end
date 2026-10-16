"use client";

/**
 * CompanyScopePicker — names the company a company-scoped page shows (library,
 * inventory) and, for a user of several companies, lets them switch. The choice
 * lives in the URL (`?company=<id>`) so a reload or a shared link keeps it.
 */

import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PageCompany } from "@/lib/companies/page-company";

interface CompanyScopePickerProps {
  companies: PageCompany[];
  value: string;
}

export function CompanyScopePicker({ companies, value }: CompanyScopePickerProps) {
  const t = useTranslations("companies.scopePicker");
  const router = useRouter();
  const pathname = usePathname();
  const current = companies.find((c) => c.id === value);

  if (companies.length <= 1) {
    if (!current) return null;
    return (
      <p className="mt-1 flex items-center gap-1.5 text-[13px]" style={{ color: "var(--muted)" }}>
        <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
        {current.legal_name}
      </p>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <Building2 className="h-4 w-4 shrink-0" style={{ color: "var(--muted)" }} aria-hidden="true" />
      <Select
        value={value}
        // Filters and pages belong to the company shown: switching starts afresh.
        onValueChange={(id) => router.replace(`${pathname}?company=${encodeURIComponent(id)}`)}
      >
        <SelectTrigger className="h-8 w-auto min-w-[200px] max-w-full" aria-label={t("label")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {companies.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.legal_name}
              {c.is_primary ? ` · ${t("primary")}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
