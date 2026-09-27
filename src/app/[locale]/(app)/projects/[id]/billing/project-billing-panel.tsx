"use client";

/**
 * ProjectBillingPanel — the quotes (devis) and invoices (factures) linked to
 * one project, whoever issued them.
 *
 * Read-only and compact: number, kind, recipient, status, issue date and
 * total TTC, each row linking to the document's own billing page where it is
 * edited, previewed or sent. Loads in the browser so the page shows a spinner
 * while the list arrives and offers a retry when it fails.
 *
 * Mount it with `key={projectId}`: a new project starts from a fresh loading
 * state instead of briefly showing the previous project's documents.
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { FileText, Loader2, RotateCcw } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BillingStatusBadge } from "@/components/billing/billing-status-badge";
import { ApiError } from "@/lib/api/http";
import { fetchProjectBillingDocuments } from "@/lib/api/billing/project-billing-documents";
import { kindToSegment } from "@/lib/billing/url-helpers";
import { formatDate, formatEUR } from "@/lib/utils/formatters";
import type { ProjectBillingDocumentSummary } from "@/types/billing";

type LoadState =
  | { status: "loading" }
  | { status: "error"; reason: "load" | "forbidden" }
  | { status: "ready"; documents: ProjectBillingDocumentSummary[] };

function documentHref(doc: ProjectBillingDocumentSummary): string {
  return `/billing/${kindToSegment(doc.kind)}/${doc.id}`;
}

interface ProjectBillingPanelProps {
  projectId: string;
}

export function ProjectBillingPanel({ projectId }: ProjectBillingPanelProps) {
  const t = useTranslations("billing");
  const [state, setState] = useState<LoadState>({ status: "loading" });
  // Bumped by "Try again" to re-run the fetch effect.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchProjectBillingDocuments(projectId, controller.signal)
      .then((documents) => {
        if (!controller.signal.aborted) setState({ status: "ready", documents });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const forbidden = err instanceof ApiError && err.status === 403;
        setState({ status: "error", reason: forbidden ? "forbidden" : "load" });
      });
    return () => controller.abort();
  }, [projectId, attempt]);

  function handleRetry() {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }

  const kindLabel = (doc: ProjectBillingDocumentSummary) => t(`project.kind.${doc.kind}`);
  const statusLabel = (doc: ProjectBillingDocumentSummary) =>
    t(`${doc.kind}.status.${doc.status}`);

  return (
    <div className="fade-up space-y-6 px-4 pb-12 lg:px-8">
      {state.status === "loading" && (
        <div
          role="status"
          className="folio-card flex items-center justify-center gap-2 p-12 text-[13px]"
          style={{ color: "var(--muted)" }}
        >
          <Loader2 size={18} className="animate-spin" aria-hidden="true" />
          <span>{t("project.loading")}</span>
        </div>
      )}

      {state.status === "error" && (
        <Alert variant="destructive">
          <AlertDescription>
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>
                {state.reason === "forbidden"
                  ? t("project.errors.forbidden")
                  : t("project.errors.load")}
              </span>
              {state.reason === "load" && (
                <Button variant="outline" size="sm" onClick={handleRetry}>
                  <RotateCcw size={14} aria-hidden="true" />
                  {t("project.retry")}
                </Button>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {state.status === "ready" && state.documents.length === 0 && (
        <div className="folio-card flex flex-col items-center justify-center gap-4 px-6 py-16">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: "var(--paper-2)" }}
          >
            <FileText size={22} style={{ color: "var(--muted)" }} aria-hidden="true" />
          </div>
          <div className="max-w-md text-center">
            <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
              {t("project.empty.title")}
            </p>
            <p className="mt-1 text-[13px]" style={{ color: "var(--muted)" }}>
              {t("project.empty.description")}
            </p>
          </div>
        </div>
      )}

      {state.status === "ready" && state.documents.length > 0 && (
        <>
          {/* Phone: one card per document, the whole card opens it. */}
          <ul className="space-y-2 lg:hidden">
            {state.documents.map((doc) => (
              <li key={doc.id}>
                <Link
                  prefetch={false}
                  href={documentHref(doc)}
                  className="folio-card block p-4 transition-colors hover:border-[#c9bfa9]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="num text-[12.5px] font-medium">{doc.document_number}</span>
                    <BillingStatusBadge status={doc.status} label={statusLabel(doc)} />
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-[13px]">
                    <span style={{ color: "var(--muted)" }}>{kindLabel(doc)}</span>
                    <span style={{ color: "var(--line-2)" }} aria-hidden="true">
                      ·
                    </span>
                    <span className="truncate">{doc.recipient_name}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="num text-[12px]" style={{ color: "var(--muted)" }}>
                      {formatDate(doc.issue_date)}
                    </span>
                    <span className="num text-[13px] font-medium">
                      {formatEUR(Number(doc.total_ttc))}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {/* Desktop: ledger table, the document number opens it. */}
          <div className="folio-card hidden overflow-hidden lg:block">
            <div className="overflow-x-auto">
              <table className="ledger">
                <thead>
                  <tr>
                    <th>{t("list.columns.number")}</th>
                    <th>{t("project.columns.kind")}</th>
                    <th>{t("list.columns.recipient")}</th>
                    <th>{t("list.columns.status")}</th>
                    <th>{t("list.columns.date")}</th>
                    <th style={{ textAlign: "right" }}>{t("list.columns.totalTtc")}</th>
                  </tr>
                </thead>
                <tbody>
                  {state.documents.map((doc) => (
                    <tr key={doc.id}>
                      <td className="num text-[12.5px] font-medium">
                        <Link
                          prefetch={false}
                          href={documentHref(doc)}
                          className="underline-offset-2 hover:underline"
                          style={{ color: "var(--accent)" }}
                        >
                          {doc.document_number}
                        </Link>
                      </td>
                      <td>{kindLabel(doc)}</td>
                      <td>{doc.recipient_name}</td>
                      <td>
                        <BillingStatusBadge status={doc.status} label={statusLabel(doc)} />
                      </td>
                      <td className="num" style={{ color: "var(--muted)" }}>
                        {formatDate(doc.issue_date)}
                      </td>
                      <td className="num font-medium" style={{ textAlign: "right" }}>
                        {formatEUR(Number(doc.total_ttc))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
