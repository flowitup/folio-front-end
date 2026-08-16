"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Upload, X, Loader2 } from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { uploadAnalysisAction } from "./_actions/analyses-actions";
import type { ProjectAnalysis } from "@/lib/api/project-analyses";

// ---- Constants ----

// Client-side guard mirrors the backend's 2 MB cap — the server remains
// authoritative (a spoofed/edited request still gets a 413 from the BE).
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MiB
const ACCEPT = ".html,.htm,text/html";

// ---- Props ----

type Props = {
  projectId: string;
  onUploaded: (analysis: ProjectAnalysis) => void;
};

// ---- Component ----

export function AnalysisUpload({ projectId, onUploaded }: Props) {
  const t = useTranslations("analyses.upload");
  const tErrors = useTranslations("analyses.errors");

  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  // Bumped on reset to force the (uncontrolled) file input to remount,
  // clearing its selected file without needing a ref into the shadcn Input
  // wrapper (which does not forward refs).
  const [fileInputKey, setFileInputKey] = useState(0);

  function resetForm() {
    setFile(null);
    setTitle("");
    setSummary("");
    setSourceUrl("");
    setTagInput("");
    setTags([]);
    setFileError(null);
    setFileInputKey((k) => k + 1);
  }

  function handleFileChange(selected: File | null) {
    setFileError(null);
    if (!selected) {
      setFile(null);
      return;
    }
    const isHtml =
      selected.type === "text/html" ||
      /\.html?$/i.test(selected.name);
    if (!isHtml) {
      setFile(null);
      setFileError(t("invalidFile"));
      return;
    }
    if (selected.size > MAX_SIZE_BYTES) {
      setFile(null);
      setFileError(t("tooLarge"));
      return;
    }
    setFile(selected);
    // Default the title from the filename if the user hasn't typed one yet.
    if (!title.trim()) {
      setTitle(selected.name.replace(/\.html?$/i, ""));
    }
  }

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
    if (!file || !title.trim() || submitting) return;

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title.trim());
      if (summary.trim()) formData.append("summary", summary.trim());
      if (sourceUrl.trim()) formData.append("source_url", sourceUrl.trim());
      for (const tag of tags) formData.append("tags", tag);

      const result = await uploadAnalysisAction(projectId, formData);
      if (result.ok) {
        onUploaded(result.data);
        toast.success(t("success"));
        resetForm();
        setOpen(false);
      } else {
        toast.error(tErrors(result.error as Parameters<typeof tErrors>[0]));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && submitting) return;
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" className="gap-2">
          <Upload className="size-4" aria-hidden />
          {t("trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("dialogTitle")}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            {/* File picker */}
            <div className="space-y-1">
              <Label htmlFor="analysis-upload-file">{t("file")}</Label>
              <Input
                key={fileInputKey}
                id="analysis-upload-file"
                type="file"
                accept={ACCEPT}
                disabled={submitting}
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">{t("fileHint")}</p>
              {fileError && <p className="text-xs text-destructive">{fileError}</p>}
              {file && !fileError && (
                <p className="text-xs text-muted-foreground">{file.name}</p>
              )}
            </div>

            {/* Title */}
            <div className="space-y-1">
              <Label htmlFor="analysis-upload-title">{t("titleField")}</Label>
              <Input
                id="analysis-upload-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={submitting}
                maxLength={300}
                required
              />
            </div>

            {/* Summary */}
            <div className="space-y-1">
              <Label htmlFor="analysis-upload-summary">{t("summaryField")}</Label>
              <Textarea
                id="analysis-upload-summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                disabled={submitting}
                maxLength={2000}
                rows={3}
              />
            </div>

            {/* Source URL */}
            <div className="space-y-1">
              <Label htmlFor="analysis-upload-source">{t("sourceUrlField")}</Label>
              <Input
                id="analysis-upload-source"
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                disabled={submitting}
                maxLength={2048}
              />
            </div>

            {/* Tags */}
            <div className="space-y-1">
              <Label htmlFor="analysis-upload-tags">{t("tagsField")}</Label>
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
                  id="analysis-upload-tags"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addTagFromInput();
                    }
                  }}
                  onBlur={addTagFromInput}
                  disabled={submitting}
                  className="h-7 w-32 text-xs"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={submitting || !file || !title.trim()}>
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  {t("submitting")}
                </>
              ) : (
                t("submit")
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
