"use client";

/**
 * DocumentsPanel — top-level client orchestrator for the documents page.
 * Manages: document list state, sort/filter/page, optimistic upload, delete flow.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { DocumentsList } from "./documents-list";
import { DocumentsFilters } from "./documents-filters";
import { DocumentsUpload } from "./documents-upload";
import { DocumentsPreviewDialog } from "./documents-preview-dialog";
import { DocumentsRenameDialog } from "./documents-rename-dialog";
import { DocumentsDeleteDialog } from "./documents-delete-dialog";
import {
  listDocumentsAction,
  deleteDocumentAction,
  renameDocumentAction,
  updateDocumentTagsAction,
  listDocumentTagsAction,
  listDocumentUploadersAction,
} from "./actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  DocumentUploader,
  ProjectDocument,
  ProjectDocumentKind,
} from "@/lib/api/project-documents";

// ---- Types ----

type SortColumn = "name" | "size" | "created_at" | "uploader";

const TEXT_COLUMNS: SortColumn[] = ["name", "uploader"];

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
  /** null when the server could not read the uploaders; the panel then retries once. */
  initialUploaders: DocumentUploader[] | null;
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
  initialUploaders,
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
  // Bumped to re-read the current page after a delete, so the rows of the
  // next page move up and an emptied last page steps back.
  const [reloadCount, setReloadCount] = useState(0);

  // ---- Sort/filter state ----
  const [sort, setSort] = useState<SortColumn>("created_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [kinds, setKinds] = useState<ProjectDocumentKind[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>(initialTags);
  const [uploaderId, setUploaderId] = useState<string | null>(null);
  const [uploaders, setUploaders] = useState<DocumentUploader[]>(initialUploaders ?? []);

  const hasFilters =
    kinds.length > 0 || selectedTags.length > 0 || uploaderId !== null;

  // The request the list should currently reflect; it differs from the last
  // loaded one while a sort/filter/page change is in flight. The initial
  // server-rendered page used these same defaults.
  const queryKey = JSON.stringify({
    sort,
    order,
    kinds,
    tags: selectedTags,
    uploaderId,
    page,
    reloadCount,
  });
  const [loadedKey, setLoadedKey] = useState(queryKey);
  const loading = loadedKey !== queryKey;

  // Uploader names: assigned members first, then anyone else the backend lists
  // as an uploader (a former member, a company admin who was never assigned).
  // Only someone unknown to both still reads "(former member)".
  const people = useMemo(() => {
    const memberIds = new Set(members.map((m) => m.id));
    return [
      ...members,
      ...uploaders
        .filter((u) => !memberIds.has(u.user_id))
        .map((u) => ({ id: u.user_id, firstName: u.display_name })),
    ];
  }, [members, uploaders]);

  // ---- Dialog state ----
  const [previewDoc, setPreviewDoc] = useState<ProjectDocument | null>(null);
  const [renameDoc, setRenameDoc] = useState<ProjectDocument | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<ProjectDocument | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ---- Effect: refresh list when sort/filter/page changes ----

  useEffect(() => {
    let cancelled = false;
    const requestKey = queryKey;

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
        // The page emptied under us (its last document was deleted): step
        // back to the new last page, which this effect then loads.
        if (result.data.items.length === 0 && page > 1 && result.data.total > 0) {
          setPage(Math.max(1, Math.ceil(result.data.total / perPage)));
          return;
        }
        setList(result.data.items);
        setTotal(result.data.total);
      } else {
        toast.error(t("toast.listLoadError"));
      }
      setLoadedKey(requestKey);
    }

    void refresh();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, order, kinds, selectedTags, uploaderId, page, projectId, reloadCount]);

  // ---- Uploaders (filter options + names) ----

  const refreshUploaders = useCallback(
    async (reportError = false) => {
      const result = await listDocumentUploadersAction(projectId);
      if (result.ok) {
        setUploaders(result.data);
        // Someone leaves the list the moment their last document here is
        // deleted. Still filtering on them could only show an empty list with
        // no matching option left in the select, so it goes back to "Anyone".
        setUploaderId((current) =>
          current !== null && !result.data.some((u) => u.user_id === current)
            ? null
            : current
        );
      } else if (reportError) {
        toast.error(t("toast.uploadersLoadError"));
      }
    },
    [projectId, t]
  );

  // The server could not read the uploaders: try once more from the client.
  useEffect(() => {
    if (initialUploaders === null) void refreshUploaders(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Handlers ----

  const handleUploaded = useCallback(
    (doc: ProjectDocument) => {
      // Only show the new file where the active filters would list it: a
      // fresh upload has no tags yet, and it belongs to its own uploader.
      const matchesFilters =
        (kinds.length === 0 || kinds.includes(doc.kind)) &&
        selectedTags.length === 0 &&
        (uploaderId === null || doc.uploader_id === uploaderId);
      if (matchesFilters) {
        setList((prev) => [doc, ...prev]);
        setTotal((prev) => prev + 1);
      }
      toast.success(t("toast.uploadSuccess", { filename: doc.filename }));
      // A first upload makes its author a filterable uploader.
      if (!uploaders.some((u) => u.user_id === doc.uploader_id)) {
        void refreshUploaders();
      }
    },
    [t, kinds, selectedTags, uploaderId, uploaders, refreshUploaders]
  );

  const handleSortChange = useCallback(
    (col: SortColumn) => {
      if (col === sort) {
        setOrder((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSort(col);
        // Names read A→Z first; dates and sizes newest/largest first.
        setOrder(TEXT_COLUMNS.includes(col) ? "asc" : "desc");
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
      } else if (result.error === "validation") {
        // Keep the dialog open with what was typed so it can be corrected.
        toast.error(t("rename.errorInvalid"));
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
        // Re-read the page: the next page's first row moves up, and a page
        // left empty steps back instead of showing the "no documents" state.
        setReloadCount((n) => n + 1);
        // It may have been its uploader's last document here.
        void refreshUploaders();
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
  }, [deleteDoc, projectId, t, refreshUploaders]);

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
        uploaders={uploaders}
        onChange={handleFiltersChange}
      />

      <div
        aria-busy={loading}
        data-testid="documents-list-region"
        className={cn("transition-opacity", loading && "opacity-60")}
      >
        <DocumentsList
          documents={list}
          projectId={projectId}
          currentUserId={currentUserId}
          isAdminOrOwner={isAdminOrOwner}
          members={people}
          sort={sort}
          order={order}
          availableTags={availableTags}
          filtered={hasFilters}
          onSortChange={handleSortChange}
          onPreview={setPreviewDoc}
          onRename={setRenameDoc}
          onDelete={setDeleteDoc}
          onTagsUpdate={handleTagsUpdate}
        />
      </div>

      {/* Pagination controls */}
      {(totalPages > 1 || page > 1) && (
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
