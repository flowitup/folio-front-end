"use client";

/**
 * AnalysisDetailPanel — "reading room" layout: the sandboxed viewer reads
 * full-height on the left, while title, summary, tags, uploader, source and
 * the edit/delete actions live in a meta rail on the right. Below lg the
 * report comes first, sized to the screen, and the rail follows it.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Calendar, ExternalLink, FileText, Pencil, Trash2 } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AnalysisViewer } from "../analysis-viewer";
import { AnalysisEditDialog } from "../analysis-edit-dialog";
import { AnalysisDeleteDialog } from "../analysis-delete-dialog";
import { nameInitials } from "../analysis-card";
import type { ProjectAnalysis } from "@/lib/api/project-analyses";

// ---- Props ----

type SiblingAnalysis = {
  id: string;
  title: string;
};

type Props = {
  projectId: string;
  analysis: ProjectAnalysis;
  canManage: boolean;
  /** Resolved display name of the uploader; empty once their account was erased. */
  uploaderName: string;
  /** Upload date preformatted on the server — formatting it here would
      hydration-mismatch when server and browser sit in different timezones. */
  addedOn: string;
  /** Other analyses in this project's library (current one excluded). */
  siblings: SiblingAnalysis[];
};

// ---- Component ----

export function AnalysisDetailPanel({
  projectId,
  analysis: initial,
  canManage,
  uploaderName,
  addedOn,
  siblings,
}: Props) {
  const t = useTranslations("analyses");
  const router = useRouter();

  const [analysis, setAnalysis] = useState<ProjectAnalysis>(initial);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const resolvedUploader = uploaderName || t("card.unknownUploader");

  function handleDeleted() {
    // replace, not push: Back must not return to the deleted analysis' URL.
    router.replace(`/projects/${projectId}/analyses`);
  }

  const reportUrl = `/analysis-report/${encodeURIComponent(projectId)}/${encodeURIComponent(analysis.id)}`;

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <Link
          prefetch={false}
          href={`/projects/${projectId}/analyses`}
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("title")}
        </Link>
        {/* The report alone in its own tab: no nested scrolling on phones. */}
        <a
          href={reportUrl}
          target="_blank"
          rel="noopener"
          className="inline-flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="size-4 shrink-0" aria-hidden />
          <span className="truncate">{t("detail.openFullScreen")}</span>
        </a>
      </div>

      {/* Reader + meta rail. Below lg the report comes first, sized to the
          screen, so it is readable without scrolling past the metadata; the
          title is shown above it and the rail follows. */}
      <h1 className="font-display text-lg font-medium leading-snug lg:sr-only">{analysis.title}</h1>
      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        {/* Viewer — keyed by analysis id so switching analyses remounts it
            cleanly (see the AnalysisViewer doc comment). */}
        <div className="h-[calc(100dvh-14rem)] min-h-[420px] lg:h-auto lg:min-h-[500px] lg:flex-1">
          <AnalysisViewer
            key={analysis.id}
            projectId={projectId}
            analysisId={analysis.id}
            title={analysis.title}
          />
        </div>

        {/* Meta rail */}
        <div className="flex shrink-0 flex-col gap-3 lg:w-[300px] lg:overflow-y-auto">
          <div className="flex flex-col gap-2.5 rounded-[var(--radius)] border bg-card p-4 shadow-sm">
            {/* Visual copy of the h1 above, which is screen-reader only on lg. */}
            <p aria-hidden className="hidden font-display text-lg font-medium leading-snug lg:block">
              {analysis.title}
            </p>
            {analysis.summary && (
              <p className="text-xs leading-relaxed text-muted-foreground">{analysis.summary}</p>
            )}
            {analysis.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {analysis.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="font-normal">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col rounded-[var(--radius)] border bg-card px-4 shadow-sm">
            <div className="flex items-center gap-2.5 border-b border-[var(--paper-2)] py-2.5">
              <span
                aria-hidden
                className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--paper-2)] text-[10px] font-semibold text-muted-foreground"
              >
                {nameInitials(resolvedUploader)}
              </span>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-2)]">
                  {t("detail.uploadedByLabel")}
                </div>
                <div className="truncate text-xs">{resolvedUploader}</div>
              </div>
            </div>
            <div
              className={`flex items-center gap-2.5 py-2.5 ${analysis.source_url ? "border-b border-[var(--paper-2)]" : ""}`}
            >
              <Calendar className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-2)]">
                  {t("detail.addedLabel")}
                </div>
                <div className="text-xs">{addedOn}</div>
              </div>
            </div>
            {analysis.source_url && (
              <div className="flex items-center gap-2.5 py-2.5">
                <ExternalLink className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-2)]">
                    {t("detail.sourceLabel")}
                  </div>
                  <a
                    href={analysis.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-xs text-[var(--accent-ink)] hover:underline"
                  >
                    {analysis.source_url}
                  </a>
                </div>
              </div>
            )}
          </div>

          {canManage && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5"
                onClick={() => setEditing(true)}
              >
                <Pencil className="size-3.5" aria-hidden />
                {t("edit.trigger")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setDeleting(true)}
              >
                <Trash2 className="size-3.5" aria-hidden />
                {t("delete.trigger")}
              </Button>
            </div>
          )}

          {siblings.length > 0 && (
            <div className="flex flex-col gap-2 rounded-[var(--radius)] bg-[var(--paper-2)] px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("detail.inThisLibrary")}
              </div>
              {siblings.map((sibling) => (
                <Link
                  key={sibling.id}
                  prefetch={false}
                  href={`/projects/${projectId}/analyses/${sibling.id}`}
                  className="flex items-center gap-2 text-xs text-[var(--ink-2)] hover:text-[var(--accent-ink)]"
                >
                  <FileText className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="truncate">{sibling.title}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <AnalysisEditDialog
        projectId={projectId}
        analysis={editing ? analysis : null}
        onCancel={() => setEditing(false)}
        onUpdated={(updated) => {
          setAnalysis(updated);
          setEditing(false);
        }}
      />

      <AnalysisDeleteDialog
        projectId={projectId}
        analysis={deleting ? analysis : null}
        onCancel={() => setDeleting(false)}
        onDeleted={handleDeleted}
      />
    </>
  );
}
