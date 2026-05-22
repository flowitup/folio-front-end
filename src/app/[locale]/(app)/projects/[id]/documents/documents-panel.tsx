"use client";

/**
 * DocumentsPanel — top-level client orchestrator for the documents page.
 * Manages: document list state, sort/filter/page, optimistic upload, delete flow.
 */

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { DocumentsList } from "./documents-list";
import { DocumentsFilters } from "./documents-filters";
import { DocumentsUpload } from "./documents-upload";
import { DocumentsPreviewDialog } from "./documents-preview-dialog";
import { DocumentsRenameDialog } from "./documents-rename-dialog";
import { DocumentsDeleteDialog } from "./documents-delete-dialog";
import { listDocumentsAction, deleteDocumentAction, renameDocumentAction, updateDocumentTagsAction, listDocumentTagsAction } from "./actions";
import { Button } from "@/components/ui/button";
import type { ProjectDocument, ProjectDocumentKind } from "@/lib/api/project-documents";

// ---- Types ----

type SortColumn = "name" | "size" | "created_at" | "uploader";

type Member = {
  id: string;
  firstName?: string;
  email?: string;
};

type Props = {
  projectId: string;
  initialDocuments: ProjectDocument[];
  initialTotal: number;
  initialTags: string[];
  members: Member[];
  currentUserId: string;
  isAdminOrOwner: boolean;
};

// ---- Component ----

export function DocumentsPanel({
  projectId,
  initialDocuments,
  initialTotal,
  initialTags,
  members,
  currentUserId,
  isAdminOrOwner,
}: Props) {
  const t = useTranslations("documents");

  // ---- List state ----
  const [list, setList] = useState<ProjectDocument[]>(initialDocuments);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const perPage = 25;

  // ---- Sort/filter state ----
  const [sort, setSort] = useState<SortColumn>("created_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [kinds, setKinds] = useState<ProjectDocumentKind[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>(initialTags);
  const [uploaderId, setUploaderId] = useState<string | null>(null);

  // ---- Dialog state ----
  const [previewDoc, setPreviewDoc] = useState<ProjectDocument | null>(null);
  const [renameDoc, setRenameDoc] = useState<ProjectDocument | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<ProjectDocument | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ---- Effect: refresh list when sort/filter/page changes ----

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      const result = await listDocumentsAction(projectId, {
        sort,
        order,
        kinds: kinds.length > 0 ? kinds : undefined,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        uploaderId: uploaderId ?? undefined,
        page,
        perPage,
      });

      if (cancelled) return;

      if (result.ok) {
        setList(result.data.items);
        setTotal(result.data.total);
      } else {
        toast.error(t("toast.listLoadError"));
      }
    }

    void refresh();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, order, kinds, selectedTags, uploaderId, page, projectId]);

  // ---- Handlers ----

  const handleUploaded = useCallback(
    (doc: ProjectDocument) => {
      setList((prev) => [doc, ...prev]);
      setTotal((prev) => prev + 1);
      toast.success(t("toast.uploadSuccess", { filename: doc.filename }));
    },
    [t]
  );

  const handleSortChange = useCallback(
    (col: SortColumn) => {
      if (col === sort) {
        setOrder((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSort(col);
        setOrder("desc");
      }
      setPage(1);
    },
    [sort]
  );

  const handleFiltersChange = useCallback(
    (next: { kinds: ProjectDocumentKind[]; tags: string[]; uploaderId: string | null }) => {
      setKinds(next.kinds);
      setSelectedTags(next.tags);
      setUploaderId(next.uploaderId);
      setPage(1);
    },
    []
  );

  const refreshAvailableTags = useCallback(async () => {
    const result = await listDocumentTagsAction(projectId);
    if (result.ok) setAvailableTags(result.data);
  }, [projectId]);

  const handleTagsUpdate = useCallback(
    async (docId: string, tags: string[]) => {
      const result = await updateDocumentTagsAction(projectId, docId, tags);
      if (result.ok) {
        setList((prev) => prev.map((d) => (d.id === docId ? result.data : d)));
        void refreshAvailableTags();
      } else {
        toast.error(t("toast.listLoadError"));
      }
    },
    [projectId, t, refreshAvailableTags]
  );

  const handleRenameConfirm = useCallback(
    async (newFilename: string) => {
      if (!renameDoc) return;

      const result = await renameDocumentAction(projectId, renameDoc.id, newFilename);

      if (result.ok) {
        setList((prev) =>
          prev.map((d) => (d.id === renameDoc.id ? result.data : d))
        );
        toast.success(t("rename.success"));
        setRenameDoc(null);
      } else if (result.error === "forbidden") {
        toast.error(t("rename.errorForbidden"));
        setRenameDoc(null);
      } else {
        toast.error(t("rename.errorServer"));
        setRenameDoc(null);
      }
    },
    [renameDoc, projectId, t]
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteDoc) return;
    setDeleting(true);

    try {
      const result = await deleteDocumentAction(projectId, deleteDoc.id);

      if (result.ok) {
        setList((prev) => prev.filter((d) => d.id !== deleteDoc.id));
        setTotal((prev) => Math.max(0, prev - 1));
        toast.success(t("delete.success"));
        setDeleteDoc(null);
      } else if (result.error === "forbidden") {
        toast.error(t("delete.errorForbidden"));
        setDeleteDoc(null);
      } else {
        toast.error(t("delete.errorServer"));
        setDeleteDoc(null);
      }
    } finally {
      setDeleting(false);
    }
  }, [deleteDoc, projectId, t]);

  // ---- Pagination ----

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  // ---- Render ----

  return (
    <div className="space-y-6">
      <DocumentsUpload projectId={projectId} onUploaded={handleUploaded} />

      <DocumentsFilters
        kinds={kinds}
        selectedTags={selectedTags}
        availableTags={availableTags}
        uploaderId={uploaderId}
        members={members}
        onChange={handleFiltersChange}
      />

      <DocumentsList
        documents={list}
        projectId={projectId}
        currentUserId={currentUserId}
        isAdminOrOwner={isAdminOrOwner}
        members={members}
        sort={sort}
        order={order}
        availableTags={availableTags}
        onSortChange={handleSortChange}
        onPreview={setPreviewDoc}
        onRename={setRenameDoc}
        onDelete={setDeleteDoc}
        onTagsUpdate={handleTagsUpdate}
      />

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            {t("pagination.prev")}
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            {t("pagination.next")}
          </Button>
        </div>
      )}

      <DocumentsPreviewDialog
        doc={previewDoc}
        projectId={projectId}
        onClose={() => setPreviewDoc(null)}
      />

      <DocumentsRenameDialog
        doc={renameDoc}
        onCancel={() => setRenameDoc(null)}
        onConfirm={handleRenameConfirm}
      />

      <DocumentsDeleteDialog
        doc={deleteDoc}
        onCancel={() => !deleting && setDeleteDoc(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
