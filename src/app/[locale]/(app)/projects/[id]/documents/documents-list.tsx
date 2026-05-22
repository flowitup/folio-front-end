"use client";

import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";
import { useState, useRef } from "react";
import {
  ChevronUp,
  ChevronDown,
  FileText,
  Image as ImageIcon,
  Sheet,
  Box,
  File,
  Eye,
  Download,
  Pencil,
  Trash2,
  Tag,
  Plus,
  X,
} from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import type { ProjectDocument, ProjectDocumentKind } from "@/lib/api/project-documents";
import { downloadProjectDocument } from "@/lib/api/project-document-blob";

// ---- Helpers ----

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

type Member = {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
};

function displayName(m: Member): string {
  const full = [m.firstName, m.lastName].filter(Boolean).join(" ").trim();
  return full || m.email || "";
}

function KindIcon({ kind }: { kind: ProjectDocumentKind }) {
  const cls = "size-4 shrink-0 text-muted-foreground";
  switch (kind) {
    case "pdf":
    case "doc":
    case "text":
      return <FileText className={cls} aria-hidden />;
    case "image":
      return <ImageIcon className={cls} aria-hidden />;
    case "spreadsheet":
      return <Sheet className={cls} aria-hidden />;
    case "cad":
      return <Box className={cls} aria-hidden />;
    default:
      return <File className={cls} aria-hidden />;
  }
}

// ---- Sort column type ----

type SortColumn = "name" | "size" | "created_at" | "uploader";

// ---- SortHeader — declared outside DocumentsList to avoid re-creating on each render ----

type SortHeaderProps = {
  column: SortColumn;
  label: string;
  activeSort: SortColumn;
  activeOrder: "asc" | "desc";
  onSortChange: (col: SortColumn) => void;
};

function SortHeader({ column, label, activeSort, activeOrder, onSortChange }: SortHeaderProps) {
  const isActive = activeSort === column;
  return (
    <button
      type="button"
      onClick={() => onSortChange(column)}
      className="flex items-center gap-1 font-medium hover:text-foreground transition-colors"
      style={{ color: isActive ? "var(--foreground)" : "var(--muted-foreground)" }}
    >
      {label}
      {isActive ? (
        activeOrder === "asc" ? (
          <ChevronUp className="size-3.5" />
        ) : (
          <ChevronDown className="size-3.5" />
        )
      ) : (
        <ChevronDown className="size-3.5 opacity-30" />
      )}
    </button>
  );
}

// ---- Props ----

type Props = {
  documents: ProjectDocument[];
  projectId: string;
  currentUserId: string;
  isAdminOrOwner: boolean;
  members: Member[];
  sort: SortColumn;
  order: "asc" | "desc";
  availableTags: string[];
  onSortChange: (sort: SortColumn) => void;
  onPreview: (doc: ProjectDocument) => void;
  onRename: (doc: ProjectDocument) => void;
  onDelete: (doc: ProjectDocument) => void;
  onTagsUpdate: (docId: string, tags: string[]) => void;
};

// ---- Component ----

export function DocumentsList({
  documents,
  currentUserId,
  isAdminOrOwner,
  members,
  sort,
  order,
  availableTags,
  onSortChange,
  onPreview,
  onRename,
  onDelete,
  onTagsUpdate,
}: Props) {
  const t = useTranslations("documents.list");
  const tKinds = useTranslations("documents.kinds");
  const tTags = useTranslations("documents.tags");
  const locale = useLocale();
  const [editingTagsDocId, setEditingTagsDocId] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");
  const tagInputRef = useRef<HTMLInputElement>(null);

  const memberMap = new Map<string, Member>(members.map((m) => [m.id, m]));

  function resolveUploaderName(uploaderId: string): string {
    const m = memberMap.get(uploaderId);
    if (!m) return t("formerMember");
    return displayName(m) || t("formerMember");
  }

  function formatDate(iso: string): string {
    try {
      return new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  const canPreview = (doc: ProjectDocument) =>
    doc.kind === "pdf" || doc.kind === "image";

  const canRename = (doc: ProjectDocument) =>
    doc.uploader_id === currentUserId || isAdminOrOwner;

  const canDelete = (doc: ProjectDocument) =>
    doc.uploader_id === currentUserId || isAdminOrOwner;

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>
            <SortHeader
              column="name"
              label={t("columns.file")}
              activeSort={sort}
              activeOrder={order}
              onSortChange={onSortChange}
            />
          </TableHead>
          <TableHead>{t("columns.type")}</TableHead>
          <TableHead>{tTags("column")}</TableHead>
          <TableHead>
            <SortHeader
              column="size"
              label={t("columns.size")}
              activeSort={sort}
              activeOrder={order}
              onSortChange={onSortChange}
            />
          </TableHead>
          <TableHead>
            <SortHeader
              column="uploader"
              label={t("columns.uploadedBy")}
              activeSort={sort}
              activeOrder={order}
              onSortChange={onSortChange}
            />
          </TableHead>
          <TableHead>
            <SortHeader
              column="created_at"
              label={t("columns.uploaded")}
              activeSort={sort}
              activeOrder={order}
              onSortChange={onSortChange}
            />
          </TableHead>
          <TableHead className="text-right">{t("columns.actions")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {documents.map((doc) => (
          <TableRow key={doc.id}>
            {/* File name + icon */}
            <TableCell className="max-w-[240px]">
              <div className="flex items-center gap-2 min-w-0">
                <KindIcon kind={doc.kind} />
                <span className="truncate text-sm font-medium">{doc.filename}</span>
              </div>
            </TableCell>

            {/* Kind badge */}
            <TableCell>
              <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium">
                {tKinds(doc.kind)}
              </span>
            </TableCell>

            {/* Tags */}
            <TableCell className="max-w-[200px]">
              {editingTagsDocId === doc.id ? (
                <div className="flex flex-wrap items-center gap-1">
                  {doc.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-0.5 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => onTagsUpdate(doc.id, doc.tags.filter((t) => t !== tag))}
                        className="ml-0.5 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800"
                        aria-label={tTags("remove")}
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
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && tagInput.trim()) {
                          e.preventDefault();
                          const newTag = tagInput.trim().toLowerCase();
                          if (!doc.tags.includes(newTag)) {
                            onTagsUpdate(doc.id, [...doc.tags, newTag]);
                          }
                          setTagInput("");
                        } else if (e.key === "Escape") {
                          setEditingTagsDocId(null);
                          setTagInput("");
                        }
                      }}
                      placeholder={tTags("placeholder")}
                      list={`tags-datalist-${doc.id}`}
                      className="h-6 w-20 rounded border bg-transparent px-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
                      autoFocus
                    />
                    <datalist id={`tags-datalist-${doc.id}`}>
                      {availableTags
                        .filter((t) => !doc.tags.includes(t))
                        .map((t) => (
                          <option key={t} value={t} />
                        ))}
                    </datalist>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTagsDocId(null);
                        setTagInput("");
                      }}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label={tTags("done")}
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
                      className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                    >
                      {tag}
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTagsDocId(doc.id);
                      setTagInput("");
                    }}
                    className="inline-flex items-center rounded-full border border-dashed px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    title={tTags("add")}
                    aria-label={tTags("add")}
                  >
                    <Plus className="size-3" />
                  </button>
                </div>
              )}
            </TableCell>

            {/* Size */}
            <TableCell className="text-sm text-muted-foreground">
              {formatBytes(doc.size_bytes)}
            </TableCell>

            {/* Uploaded by */}
            <TableCell className="text-sm text-muted-foreground">
              {resolveUploaderName(doc.uploader_id)}
            </TableCell>

            {/* Uploaded at */}
            <TableCell className="text-sm text-muted-foreground">
              {formatDate(doc.uploaded_at)}
            </TableCell>

            {/* Actions */}
            <TableCell>
              <div className="flex items-center justify-end gap-1">
                {canPreview(doc) && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onPreview(doc)}
                    title={t("actions.preview")}
                    aria-label={t("actions.preview")}
                  >
                    <Eye />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title={t("actions.download")}
                  aria-label={t("actions.download")}
                  onClick={async () => {
                    try {
                      await downloadProjectDocument(doc.project_id, doc.id, doc.filename);
                    } catch {
                      toast.error(t("actions.downloadError"));
                    }
                  }}
                >
                  <Download className="size-4" aria-hidden />
                </Button>
                {canRename(doc) && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onRename(doc)}
                    title={t("actions.rename")}
                    aria-label={t("actions.rename")}
                  >
                    <Pencil className="size-4" aria-hidden />
                  </Button>
                )}
                {canDelete(doc) && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onDelete(doc)}
                    title={t("actions.delete")}
                    aria-label={t("actions.delete")}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 />
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
