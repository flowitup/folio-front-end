import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { fetchBillingDocument } from "@/lib/api/billing/documents";
import { fetchBillingTemplate } from "@/lib/api/billing/templates";

interface Params {
  params: Promise<{ locale: string; id: string }>;
}

/**
 * Tab titles of the billing editors, so two open documents can be told apart:
 * "Devis DEV-2026-001 · Folio", "Modèle Rénovation salle de bain · Folio".
 * Falls back to the section name when the document cannot be read (the page
 * itself then shows its 404 or error).
 */
export function billingDocumentTitle(sectionKey: "meta.quotes" | "meta.invoices") {
  return async function generateMetadata({ params }: Params): Promise<Metadata> {
    const { locale, id } = await params;
    const t = await getTranslations({ locale });
    let label = t(sectionKey);
    try {
      const doc = await fetchBillingDocument(id);
      label = `${label} ${doc.document_number}`;
    } catch {
      // Section name only.
    }
    return { title: { absolute: `${label} · ${t("common.appName")}` } };
  };
}

export async function billingTemplateTitle({ params }: Params): Promise<Metadata> {
  const { locale, id } = await params;
  const t = await getTranslations({ locale });
  let label = t("meta.template");
  try {
    const template = await fetchBillingTemplate(id);
    label = `${label} ${template.name}`;
  } catch {
    // Section name only.
  }
  return { title: { absolute: `${label} · ${t("common.appName")}` } };
}
