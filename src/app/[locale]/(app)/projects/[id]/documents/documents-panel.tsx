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
import { DocumentsDeleteDialog } from "./documents-delete-dialog";
import { listDocumentsAction, deleteDocumentAction } from "./actions";
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
  members: Member[];
  currentUserId: string;
  isAdminOrOwner: boolean;
};

// ---- Component ----

export function DocumentsPanel({
  projectId,
  initialDocuments,
  initialTotal,
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
  const [uploaderId, setUploaderId] = useState<string | null>(null);

  // ---- Dialog state ----
  const [previewDoc, setPreviewDoc] = useState<ProjectDocument | null>(null);
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
  }, [sort, order, kinds, uploaderId, page, projectId]);

  // ---- Handlers ----

  const handleUploaded = useCallback(
    (doc: ProjectDocument) => {
      // Optimistically prepend; if not sorted by created_at desc, a refresh
      // would re-order — but the optimistic entry is good enough UX.
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
    (next: { kinds: ProjectDocumentKind[]; uploaderId: string | null }) => {
      setKinds(next.kinds);
      setUploaderId(next.uploaderId);
      setPage(1);
    },
    []
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
        onSortChange={handleSortChange}
        onPreview={setPreviewDoc}
        onDelete={setDeleteDoc}
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
            Prev
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
            Next
          </Button>
        </div>
      )}

      <DocumentsPreviewDialog
        doc={previewDoc}
        onClose={() => setPreviewDoc(null)}
      />

      <DocumentsDeleteDialog
        doc={deleteDoc}
        onCancel={() => !deleting && setDeleteDoc(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
