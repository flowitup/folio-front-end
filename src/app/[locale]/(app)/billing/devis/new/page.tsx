/**
 * New devis page — server component.
 *
 * Guards:
 *   - Missing company profile → renders an inline callout instead of the form.
 *
 * Query params:
 *   ?from=<id>       — pre-load source document (clone mode)
 *   ?template=<id>   — pre-load template (apply-template mode)
 *
 * Both pre-loads are best-effort: if the API is unavailable (BE not yet merged)
 * the fallback is a blank form with a non-fatal console warning.
 */

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { fetchCompanyProfile } from "@/lib/api/billing/company-profile";
import { fetchBillingDocument } from "@/lib/api/billing/documents";
import { fetchBillingTemplate } from "@/lib/api/billing/templates";
import { BillingDocumentForm } from "@/components/billing/billing-document-form";
import type { BillingDocument, BillingDocumentTemplate } from "@/types/billing";

interface NewDevisPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function NewDevisPage({ searchParams }: NewDevisPageProps) {
  const params = await searchParams;
  const fromId = typeof params.from === "string" ? params.from : undefined;
  const templateId = typeof params.template === "string" ? params.template : undefined;

  // Guard: company profile must exist before creating billing documents.
  let profileMissing = false;
  try {
    const profile = await fetchCompanyProfile();
    if (!profile) profileMissing = true;
  } catch {
    // Network error during profile check — allow form to render; server will
    // enforce the guard on submit with a 409 company_profile_missing error.
    console.warn("[NewDevisPage] Could not check company profile.");
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
      console.warn("[NewDevisPage] Could not load source document:", fromId);
    }
  }

  // Optional: pre-load template for apply-template mode
  let templateDoc: BillingDocumentTemplate | undefined;
  if (templateId && !sourceDoc) {
    try {
      templateDoc = await fetchBillingTemplate(templateId);
    } catch {
      console.warn("[NewDevisPage] Could not load template:", templateId);
    }
  }

  return (
    <BillingDocumentForm
      mode="create"
      kind="devis"
      initialFromSource={sourceDoc}
      initialFromTemplate={templateDoc}
    />
  );
}

function MissingProfileCallout() {
  return (
    <div className="fade-up px-8 py-12">
      <div className="folio-card flex max-w-lg flex-col items-start gap-4 p-6">
        <div className="flex items-center gap-3 text-amber-700">
          <AlertTriangle size={20} className="shrink-0" />
          <p className="text-sm font-medium">Company profile required</p>
        </div>
        <p className="text-[13px]" style={{ color: "var(--muted)" }}>
          Before creating a devis, please complete your company profile. It
          provides the issuer details (legal name, address, SIRET, TVA number)
          that are printed on every document.
        </p>
        <Link
          href="/settings#company-profile"
          className="rounded-md bg-amber-50 px-3 py-1.5 text-[13px] font-medium text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100 transition-colors"
        >
          Go to Settings → Company Profile
        </Link>
      </div>
    </div>
  );
}
