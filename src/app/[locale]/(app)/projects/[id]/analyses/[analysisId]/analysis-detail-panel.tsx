"use client";

/**
 * AnalysisDetailPanel — header (title, summary, source link, tags,
 * edit/delete) plus the sandboxed viewer filling the remaining space.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AnalysisViewer } from "../analysis-viewer";
import { AnalysisEditDialog } from "../analysis-edit-dialog";
import { AnalysisDeleteDialog } from "../analysis-delete-dialog";
import type { ProjectAnalysis } from "@/lib/api/project-analyses";

// ---- Props ----

type Props = {
  projectId: string;
  analysis: ProjectAnalysis;
  canManage: boolean;
};

// ---- Component ----

export function AnalysisDetailPanel({ projectId, analysis: initial, canManage }: Props) {
  const t = useTranslations("analyses");
  const router = useRouter();

  const [analysis, setAnalysis] = useState<ProjectAnalysis>(initial);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function handleDeleted() {
    router.push(`/projects/${projectId}/analyses`);
  }

  return (
    <>
      {/* Header */}
      <div className="flex flex-col gap-3">
        <Link
          prefetch={false}
          href={`/projects/${projectId}/analyses`}
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("title")}
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <h1 className="text-xl font-semibold">{analysis.title}</h1>
            {analysis.summary && (
              <p className="text-sm text-muted-foreground">{analysis.summary}</p>
            )}
            {analysis.source_url && (
              <a
                href={analysis.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-[var(--accent)] hover:underline"
              >
                {analysis.source_url}
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            )}
            {analysis.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {analysis.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="font-normal">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {canManage && (
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditing(true)}>
                <Pencil className="size-3.5" aria-hidden />
                {t("edit.trigger")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setDeleting(true)}
              >
                <Trash2 className="size-3.5" aria-hidden />
                {t("delete.trigger")}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Viewer — keyed by analysis id so switching analyses remounts it
          cleanly (see the AnalysisViewer doc comment). */}
      <div className="min-h-[500px] flex-1">
        <AnalysisViewer
          key={analysis.id}
          projectId={projectId}
          analysisId={analysis.id}
          title={analysis.title}
        />
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
