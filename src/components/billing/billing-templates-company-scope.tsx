"use client";

/**
 * BillingTemplatesCompanyScope — company picker wrapper for the templates
 * list (roles-permissions-redesign: templates are company-scoped, GET
 * /billing-document-templates?company_id=). Mirrors
 * PaymentMethodsSettingsSection's pattern: default to the primary admin
 * company, show a picker only when the caller admins more than one, refetch
 * and remount BillingTemplatesList (keyed by company id) on switch.
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listBillingTemplatesAction } from "@/app/[locale]/(app)/billing/_actions/billing-actions";
import { BillingTemplatesList } from "@/components/billing/billing-templates-list";
import type { BillingDocumentTemplate } from "@/types/billing";
import type { MyCompany } from "@/types/companies";

interface Props {
  /** Companies the caller administers — empty when they admin none (legacy unscoped fallback). */
  adminCompanies: MyCompany[];
  initialTemplates: BillingDocumentTemplate[];
  initialCompanyId: string | null;
}

export function BillingTemplatesCompanyScope({ adminCompanies, initialTemplates, initialCompanyId }: Props) {
  const t = useTranslations("billing.templates");
  const [companyId, setCompanyId] = useState<string | null>(initialCompanyId);
  const [templates, setTemplates] = useState(initialTemplates);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (companyId === initialCompanyId) return; // Already have the initial fetch's data.
    let cancelled = false;
    setIsLoading(true);
    void listBillingTemplatesAction(undefined, companyId ?? undefined).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setTemplates(result.data);
      } else {
        // Surface the failure — an empty list otherwise reads as "no
        // templates in this company", not "couldn't load templates".
        toast.error(result.error.message);
      }
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only refetch on companyId change, not initialCompanyId
  }, [companyId]);

  return (
    <div className="space-y-4">
      {adminCompanies.length > 1 && (
        <div className="flex items-center gap-3">
          <label className="label-cap shrink-0" htmlFor="billing-templates-company">
            {t("companyLabel")}
          </label>
          <Select value={companyId ?? undefined} onValueChange={setCompanyId}>
            <SelectTrigger id="billing-templates-company" className="h-8 w-full max-w-xs text-[13px]">
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

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={20} className="animate-spin" style={{ color: "var(--muted)" }} />
        </div>
      ) : (
        <BillingTemplatesList
          key={companyId ?? "unscoped"}
          initialTemplates={templates}
          companyId={companyId}
        />
      )}
    </div>
  );
}
