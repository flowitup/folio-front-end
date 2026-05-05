/**
 * New facture page — server component.
 *
 * Guards:
 *   - Missing company profile → renders an inline callout instead of the form.
 *
 * Query params:
 *   ?from=<id>       — pre-load source document (clone mode)
 *   ?template=<id>   — pre-load template (apply-template mode)
 */

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { fetchCompanyProfile } from "@/lib/api/billing/company-profile";
import { fetchBillingDocument } from "@/lib/api/billing/documents";
import { fetchBillingTemplate } from "@/lib/api/billing/templates";
import { BillingDocumentForm } from "@/components/billing/billing-document-form";
import type { BillingDocument, BillingDocumentTemplate } from "@/types/billing";

interface NewFacturePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function NewFacturePage({ searchParams }: NewFacturePageProps) {
  const params = await searchParams;
  const fromId = typeof params.from === "string" ? params.from : undefined;
  const templateId = typeof params.template === "string" ? params.template : undefined;

  // Guard: company profile must exist before creating billing documents.
  let profileMissing = false;
  try {
    const profile = await fetchCompanyProfile();
    if (!profile) profileMissing = true;
  } catch {
    console.warn("[NewFacturePage] Could not check company profile.");
  }

  if (profileMissing) {
    return <MissingProfileCallout />;
  }

  // Optional: pre-load source document for clone mode
  let sourceDoc: BillingDocument | undefined;
  if (fromId) {
    try {
      sourceDoc = await fetchBillingDocument(fromId);
    } catch {
      console.warn("[NewFacturePage] Could not load source document:", fromId);
    }
  }

  // Optional: pre-load template for apply-template mode
  let templateDoc: BillingDocumentTemplate | undefined;
  if (templateId && !sourceDoc) {
    try {
      templateDoc = await fetchBillingTemplate(templateId);
    } catch {
      console.warn("[NewFacturePage] Could not load template:", templateId);
    }
  }

  return (
    <BillingDocumentForm
      mode="create"
      kind="facture"
      initialFromSource={sourceDoc}
      initialFromTemplate={templateDoc}
    />
  );
}

async function MissingProfileCallout() {
  const t = await getTranslations("billing.form.missingProfile");
  return (
    <div className="fade-up px-8 py-12">
      <div className="folio-card flex max-w-lg flex-col items-start gap-4 p-6">
        <div className="flex items-center gap-3 text-amber-700">
          <AlertTriangle size={20} className="shrink-0" />
          <p className="text-sm font-medium">{t("title")}</p>
        </div>
        <p className="text-[13px]" style={{ color: "var(--muted)" }}>
          {t("description", { kind: "facture" })}
        </p>
        <Link
          href="/settings#company-profile"
          className="rounded-md bg-amber-50 px-3 py-1.5 text-[13px] font-medium text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100 transition-colors"
        >
          {t("cta")}
        </Link>
      </div>
    </div>
  );
}
