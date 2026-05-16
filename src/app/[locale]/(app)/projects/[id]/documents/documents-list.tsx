"use client";

import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";
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
  Trash2,
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
  onSortChange: (sort: SortColumn) => void;
  onPreview: (doc: ProjectDocument) => void;
  onDelete: (doc: ProjectDocument) => void;
};

// ---- Component ----

export function DocumentsList({
  documents,
  currentUserId,
  isAdminOrOwner,
  members,
  sort,
  order,
  onSortChange,
  onPreview,
  onDelete,
}: Props) {
  const t = useTranslations("documents.list");
  const tKinds = useTranslations("documents.kinds");
  const locale = useLocale();

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
