"use client";

/**
 * ProjectLinkedBillingDocuments — lists devis/factures linked to a project.
 *
 * Fetches via fetchProjectBillingDocuments (cookie-based client API) on mount.
 * Renders a table with kind badge, document number, recipient, amount TTC,
 * and status badge — reusing BillingStatusBadge for visual consistency.
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { BillingStatusBadge } from "@/components/billing/billing-status-badge";
import { fetchProjectBillingDocuments } from "@/lib/api/invoice-api";
import type { ProjectBillingDocumentSummary } from "@/types/billing";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatEUR = (n: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(n);

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ProjectLinkedBillingDocumentsProps {
  projectId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProjectLinkedBillingDocuments({
  projectId,
}: ProjectLinkedBillingDocumentsProps) {
  const t = useTranslations("invoices.releaseFunds");
  const tDevisStatus = useTranslations("billing.devis.status");
  const tFactureStatus = useTranslations("billing.facture.status");

  const [docs, setDocs] = useState<ProjectBillingDocumentSummary[]>([]);
  // Start true so the loading spinner shows on first mount without a flash of empty state.
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchProjectBillingDocuments(projectId)
      .then((data) => {
        if (!cancelled) {
          setDocs(data);
          setError(null);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(t("loadError"));
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, t]);

  /** Locale-aware status label reusing billing status i18n keys. */
  function statusLabel(doc: ProjectBillingDocumentSummary): string {
    if (doc.kind === "devis") {
      const valid = ["draft", "sent", "accepted", "rejected", "expired"] as const;
      if ((valid as readonly string[]).includes(doc.status)) {
        return tDevisStatus(doc.status as (typeof valid)[number]);
      }
    } else {
      const valid = ["draft", "sent", "paid", "overdue", "cancelled"] as const;
      if ((valid as readonly string[]).includes(doc.status)) {
        return tFactureStatus(doc.status as (typeof valid)[number]);
      }
    }
    return doc.status;
  }

  return (
    <div className="folio-card overflow-hidden">
      <div className="border-b px-5 py-3" style={{ borderColor: "var(--line)" }}>
        <p className="text-[13px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
          {t("linkedDocsTitle")}
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center p-10">
          <Loader2 size={18} className="animate-spin" style={{ color: "var(--muted)" }} />
        </div>
      )}

      {!isLoading && error && (
        <div className="px-5 py-4 text-[13px]" style={{ color: "var(--destructive)" }}>
          {error}
        </div>
      )}

      {!isLoading && !error && docs.length === 0 && (
        <div className="px-5 py-6 text-[13px]" style={{ color: "var(--muted)" }}>
          {t("empty")}
        </div>
      )}

      {!isLoading && !error && docs.length > 0 && (
        <div className="overflow-x-auto">
          <table className="ledger">
            <thead>
              <tr>
                <th>{t("colKind")}</th>
                <th>{t("colNumber")}</th>
                <th>{t("colRecipient")}</th>
                <th style={{ textAlign: "right" }}>{t("colAmount")}</th>
                <th>{t("colStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((doc) => (
                <tr key={doc.id}>
                  <td>
                    <span className="stamp">
                      {doc.kind === "devis" ? t("kindDevis") : t("kindFacture")}
                    </span>
                  </td>
                  <td className="num text-[12.5px]">{doc.document_number}</td>
                  <td>{doc.recipient_name}</td>
                  <td className="num font-medium" style={{ textAlign: "right" }}>
                    {formatEUR(doc.total_ttc)}
                  </td>
                  <td>
                    <BillingStatusBadge
                      status={doc.status}
                      label={statusLabel(doc)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
