"use client";

/**
 * CompanyPickerSelect — issuer company selector at the top of billing document forms.
 *
 * Behaviour by attachedCompanies.length:
 *   0 → renders nothing (parent handles the NoAttachedCompaniesCallout).
 *   1 → static label "Issued from: {legal_name}", no dropdown.
 *   2+ → shadcn Select with primary-first ordering and localStorage last-used memory.
 *
 * localStorage key: `billing.lastCompanyId.${kind}` — read only in useEffect (SSR safe).
 *
 * Default value logic (when value is null on mount):
 *   1. Last-used if still in attachedCompanies.
 *   2. Else the company with is_primary = true.
 *   3. Else first in list.
 */

import { useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MyCompany } from "@/types/companies";
import type { BillingDocumentKind } from "@/types/billing";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CompanyPickerSelectProps {
  kind: BillingDocumentKind;
  attachedCompanies: MyCompany[];
  value: string | null;
  onChange: (companyId: string) => void;
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function localStorageKey(kind: BillingDocumentKind): string {
  return `billing.lastCompanyId.${kind}`;
}

/**
 * Determine the default company ID when value is null.
 * Priority: last-used (if still attached) → primary → first.
 */
function resolveDefaultCompanyId(
  kind: BillingDocumentKind,
  companies: MyCompany[]
): string | null {
  if (companies.length === 0) return null;

  // Try last-used from localStorage (only safe in useEffect; this is called from useEffect).
  try {
    const lastUsed = localStorage.getItem(localStorageKey(kind));
    if (lastUsed && companies.some((c) => c.id === lastUsed)) {
      return lastUsed;
    }
  } catch {
    // localStorage unavailable (SSR or private-mode restriction) — ignore.
  }

  // Primary company first.
  const primary = companies.find((c) => c.is_primary);
  if (primary) return primary.id;

  // Fallback: first in list.
  return companies[0].id;
}

/**
 * Sort companies: primary first, then by attached_at descending.
 */
function sortedCompanies(companies: MyCompany[]): MyCompany[] {
  return [...companies].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
    return new Date(b.attached_at).getTime() - new Date(a.attached_at).getTime();
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CompanyPickerSelect({
  kind,
  attachedCompanies,
  value,
  onChange,
  disabled = false,
}: CompanyPickerSelectProps) {
  // Resolve and emit default on mount when value is null.
  useEffect(() => {
    if (value === null && attachedCompanies.length > 0) {
      const defaultId = resolveDefaultCompanyId(kind, attachedCompanies);
      if (defaultId) onChange(defaultId);
    }
    // Run only on mount and when attachedCompanies identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachedCompanies]);

  // Persist selection to localStorage on every change.
  function handleChange(companyId: string) {
    try {
      localStorage.setItem(localStorageKey(kind), companyId);
    } catch {
      // Ignore write failures (quota exceeded, private-mode, etc.).
    }
    onChange(companyId);
  }

  // 0 companies — render nothing; parent shows callout.
  if (attachedCompanies.length === 0) {
    return null;
  }

  // 1 company — static label only.
  if (attachedCompanies.length === 1) {
    const company = attachedCompanies[0];
    return (
      <div className="folio-card flex items-center gap-2 px-5 py-3">
        <span className="text-[12px] font-medium uppercase tracking-wider" style={{ color: "var(--muted)" }}>
          Issued from
        </span>
        <span className="text-[13px] font-medium">{company.legal_name}</span>
        {company.is_primary && (
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 ring-1 ring-blue-200">
            primary
          </span>
        )}
      </div>
    );
  }

  // 2+ companies — dropdown.
  const ordered = sortedCompanies(attachedCompanies);

  return (
    <div className="folio-card flex items-center gap-3 px-5 py-3">
      <span className="shrink-0 text-[12px] font-medium uppercase tracking-wider" style={{ color: "var(--muted)" }}>
        Issued from
      </span>
      <Select value={value ?? ""} onValueChange={handleChange} disabled={disabled}>
        <SelectTrigger className="h-8 min-w-[200px] text-[13px]">
          <SelectValue placeholder="Select company..." />
        </SelectTrigger>
        <SelectContent>
          {ordered.map((company) => (
            <SelectItem key={company.id} value={company.id}>
              <span>{company.legal_name}</span>
              {company.is_primary && (
                <span className="ml-2 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                  primary
                </span>
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
