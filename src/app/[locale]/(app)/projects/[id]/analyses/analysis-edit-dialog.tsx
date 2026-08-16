"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { updateAnalysisAction } from "./_actions/analyses-actions";
import type { ProjectAnalysis, UpdateAnalysisPayload } from "@/lib/api/project-analyses";

// ---- Props ----

type Props = {
  projectId: string;
  analysis: ProjectAnalysis | null;
  onCancel: () => void;
  onUpdated: (analysis: ProjectAnalysis) => void;
};

// ---- Component ----

export function AnalysisEditDialog({ projectId, analysis, onCancel, onUpdated }: Props) {
  const t = useTranslations("analyses.edit");
  const tErrors = useTranslations("analyses.errors");

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (analysis) {
      setTitle(analysis.title);
      setSummary(analysis.summary ?? "");
      setSourceUrl(analysis.source_url ?? "");
      setTags(analysis.tags);
      setTagInput("");
    }
  }, [analysis]);

  function addTagFromInput() {
    const value = tagInput.trim().toLowerCase();
    if (!value) return;
    if (!tags.includes(value)) setTags((prev) => [...prev, value]);
    setTagInput("");
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!analysis || saving || !title.trim()) return;

    // Only send fields that actually changed — an omitted key leaves the
    // corresponding value untouched server-side (PATCH semantics).
    const patch: UpdateAnalysisPayload = {};
    if (title.trim() !== analysis.title) patch.title = title.trim();
    const nextSummary = summary.trim() || null;
    if (nextSummary !== (analysis.summary ?? null)) patch.summary = nextSummary;
    const nextSourceUrl = sourceUrl.trim() || null;
    if (nextSourceUrl !== (analysis.source_url ?? null)) patch.source_url = nextSourceUrl;
    const tagsChanged =
      tags.length !== analysis.tags.length || tags.some((tag, i) => tag !== analysis.tags[i]);
    if (tagsChanged) patch.tags = tags;

    if (Object.keys(patch).length === 0) {
      onCancel();
      return;
    }

    setSaving(true);
    try {
      const result = await updateAnalysisAction(projectId, analysis.id, patch);
      if (result.ok) {
        onUpdated(result.data);
        toast.success(t("success"));
      } else {
        toast.error(tErrors(result.error as Parameters<typeof tErrors>[0]));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={analysis !== null} onOpenChange={(open) => !open && !saving && onCancel()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("dialogTitle")}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="space-y-1">
              <Label htmlFor="analysis-edit-title">{t("titleField")}</Label>
              <Input
                id="analysis-edit-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={saving}
                maxLength={300}
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="analysis-edit-summary">{t("summaryField")}</Label>
              <Textarea
                id="analysis-edit-summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                disabled={saving}
                maxLength={2000}
                rows={3}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="analysis-edit-source">{t("sourceUrlField")}</Label>
              <Input
                id="analysis-edit-source"
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                disabled={saving}
                maxLength={2048}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="analysis-edit-tags">{t("tagsField")}</Label>
              <div className="flex flex-wrap items-center gap-1.5">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-accent text-accent-foreground inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-0.5 rounded-full hover:bg-[var(--accent)]/20"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
                <Input
                  id="analysis-edit-tags"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addTagFromInput();
                    }
                  }}
                  onBlur={addTagFromInput}
                  disabled={saving}
                  className="h-7 w-32 text-xs"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={saving || !title.trim()}>
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  {t("saving")}
                </>
              ) : (
                t("save")
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
