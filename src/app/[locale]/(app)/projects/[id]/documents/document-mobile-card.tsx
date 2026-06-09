"use client";

import { useRef } from "react";
import type { ReactNode } from "react";
import { Eye, Download, Pencil, Trash2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProjectDocument } from "@/lib/api/project-documents";

// ---- Re-exported helper types ----

export type MobileCardMember = {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
};

export interface DocumentMobileCardProps {
  doc: ProjectDocument;
  uploaderName: string;
  formattedDate: string;
  formattedSize: string;
  kindLabel: string;
  editingTagsDocId: string | null;
  tagInput: string;
  availableTags: string[];
  canPreview: boolean;
  canRename: boolean;
  canDelete: boolean;
  kindIcon: ReactNode;
  // Labels (passed from parent to avoid hook calls in extracted component)
  labelPreview: string;
  labelDownload: string;
  labelRename: string;
  labelDelete: string;
  labelAddTag: string;
  labelRemoveTag: string;
  labelTagPlaceholder: string;
  labelTagDone: string;
  onPreview: () => void;
  onDownload: () => void;
  onRename: () => void;
  onDelete: () => void;
  onTagsUpdate: (tags: string[]) => void;
  onEditTagsOpen: () => void;
  onEditTagsClose: () => void;
  onTagInputChange: (value: string) => void;
}

export function DocumentMobileCard({
  doc,
  uploaderName,
  formattedDate,
  formattedSize,
  kindLabel,
  editingTagsDocId,
  tagInput,
  availableTags,
  canPreview,
  canRename,
  canDelete,
  kindIcon,
  labelPreview,
  labelDownload,
  labelRename,
  labelDelete,
  labelAddTag,
  labelRemoveTag,
  labelTagPlaceholder,
  labelTagDone,
  onPreview,
  onDownload,
  onRename,
  onDelete,
  onTagsUpdate,
  onEditTagsOpen,
  onEditTagsClose,
  onTagInputChange,
}: DocumentMobileCardProps) {
  const tagInputRef = useRef<HTMLInputElement>(null);
  const isEditingTags = editingTagsDocId === doc.id;

  return (
    <div className="folio-card p-4">
      {/* Header row: icon + filename + kind badge */}
      <div className="flex items-start gap-2 min-w-0">
        <span className="mt-0.5 shrink-0">{kindIcon}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium leading-tight">{doc.filename}</p>
          <div className="mt-1 flex items-center gap-2">
            <span
              className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium"
              style={{ color: "var(--muted-foreground)" }}
            >
              {kindLabel}
            </span>
            <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
              {formattedSize}
            </span>
          </div>
        </div>
      </div>

      {/* Tags row */}
      <div className="mt-2.5">
        {isEditingTags ? (
          <div className="flex flex-wrap items-center gap-1">
            {doc.tags.map((tag) => (
              <span
                key={tag}
                className="bg-accent text-accent-foreground inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => onTagsUpdate(doc.tags.filter((t) => t !== tag))}
                  className="ml-0.5 rounded-full hover:bg-[var(--accent)]/20"
                  aria-label={labelRemoveTag}
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
            <div className="flex items-center gap-1">
              <input
                ref={tagInputRef}
                type="text"
                value={tagInput}
                onChange={(e) => onTagInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && tagInput.trim()) {
                    e.preventDefault();
                    const newTag = tagInput.trim().toLowerCase();
                    if (!doc.tags.includes(newTag)) {
                      onTagsUpdate([...doc.tags, newTag]);
                    }
                    onTagInputChange("");
                  } else if (e.key === "Escape") {
                    onEditTagsClose();
                  }
                }}
                placeholder={labelTagPlaceholder}
                list={`tags-datalist-mobile-${doc.id}`}
                className="h-6 w-20 rounded border bg-transparent px-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
                autoFocus
              />
              <datalist id={`tags-datalist-mobile-${doc.id}`}>
                {availableTags
                  .filter((t) => !doc.tags.includes(t))
                  .map((t) => (
                    <option key={t} value={t} />
                  ))}
              </datalist>
              <button
                type="button"
                onClick={onEditTagsClose}
                className="text-muted-foreground hover:text-foreground"
                aria-label={labelTagDone}
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-1">
            {doc.tags.map((tag) => (
              <span
                key={tag}
                className="bg-accent text-accent-foreground inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
              >
                {tag}
              </span>
            ))}
            <button
              type="button"
              onClick={onEditTagsOpen}
              className="inline-flex items-center rounded-full border border-dashed px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              title={labelAddTag}
              aria-label={labelAddTag}
            >
              <Plus className="size-3" />
            </button>
          </div>
        )}
      </div>

      {/* Meta: uploader + date */}
      <div
        className="mt-2.5 flex items-center justify-between text-[12px]"
        style={{ color: "var(--muted-foreground)" }}
      >
        <span className="truncate">{uploaderName}</span>
        <span className="ml-2 shrink-0">{formattedDate}</span>
      </div>

      {/* Action buttons */}
      <div
        className="mt-2.5 flex items-center gap-1 border-t pt-2.5"
        style={{ borderColor: "var(--line)" }}
      >
        {canPreview && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onPreview}
            title={labelPreview}
            aria-label={labelPreview}
            className="min-h-[40px] min-w-[40px]"
          >
            <Eye className="size-4" aria-hidden />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onDownload}
          title={labelDownload}
          aria-label={labelDownload}
          className="min-h-[40px] min-w-[40px]"
        >
          <Download className="size-4" aria-hidden />
        </Button>
        {canRename && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onRename}
            title={labelRename}
            aria-label={labelRename}
            className="min-h-[40px] min-w-[40px]"
          >
            <Pencil className="size-4" aria-hidden />
          </Button>
        )}
        {canDelete && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onDelete}
            title={labelDelete}
            aria-label={labelDelete}
            className="min-h-[40px] min-w-[40px] text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        )}
      </div>
    </div>
  );
}
