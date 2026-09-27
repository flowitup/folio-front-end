/**
 * DocumentsPanel — delete, rename, tag and sort flows.
 *
 * The list, filters, upload and dialogs are stubs exposing the panel's
 * callbacks, so each test drives the panel exactly as the real children do.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ProjectDocument } from "@/lib/api/project-documents";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}));

vi.mock("../actions", () => ({
  listDocumentsAction: vi.fn(),
  deleteDocumentAction: vi.fn(),
  renameDocumentAction: vi.fn(),
  updateDocumentTagsAction: vi.fn(),
  listDocumentTagsAction: vi.fn(),
  listDocumentUploadersAction: vi.fn(),
}));

type ListStubProps = {
  documents: ProjectDocument[];
  sort: string;
  order: string;
  onSortChange: (col: "name" | "size" | "created_at" | "uploader") => void;
  onDelete: (doc: ProjectDocument) => void;
  onRename: (doc: ProjectDocument) => void;
  onTagsUpdate: (docId: string, tags: string[]) => void;
};

let lastListProps: ListStubProps | null = null;

vi.mock("../documents-list", () => ({
  DocumentsList: (props: ListStubProps) => {
    lastListProps = props;
    return (
      <ul data-testid="documents-list" data-sort={`${props.sort}:${props.order}`}>
        {props.documents.map((d) => (
          <li key={d.id}>
            {d.filename}
            <button type="button" onClick={() => props.onDelete(d)}>
              delete {d.filename}
            </button>
            <button type="button" onClick={() => props.onRename(d)}>
              rename {d.filename}
            </button>
          </li>
        ))}
        {props.documents.length === 0 && <li>empty</li>}
      </ul>
    );
  },
}));

type FiltersStubProps = { selectedTags: string[]; availableTags: string[] };
let lastFiltersProps: FiltersStubProps | null = null;
vi.mock("../documents-filters", () => ({
  DocumentsFilters: (props: FiltersStubProps) => {
    lastFiltersProps = props;
    return null;
  },
}));
vi.mock("../documents-upload", () => ({ DocumentsUpload: () => null }));
vi.mock("../documents-preview-dialog", () => ({ DocumentsPreviewDialog: () => null }));

vi.mock("../documents-rename-dialog", () => ({
  DocumentsRenameDialog: ({
    doc,
    onConfirm,
  }: {
    doc: ProjectDocument | null;
    onConfirm: (name: string) => void;
  }) =>
    doc ? (
      <div data-testid="rename-dialog">
        <button type="button" onClick={() => onConfirm("renamed.pdf")}>
          confirm rename
        </button>
      </div>
    ) : null,
}));

vi.mock("../documents-delete-dialog", () => ({
  DocumentsDeleteDialog: ({
    doc,
    onConfirm,
  }: {
    doc: ProjectDocument | null;
    onConfirm: () => void;
  }) =>
    doc ? (
      <button type="button" onClick={onConfirm}>
        confirm delete
      </button>
    ) : null,
}));

import { toast } from "sonner";
import {
  listDocumentsAction,
  deleteDocumentAction,
  renameDocumentAction,
  updateDocumentTagsAction,
  listDocumentTagsAction,
  listDocumentUploadersAction,
} from "../actions";
import { DocumentsPanel } from "../documents-panel";

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const USER = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

function makeDoc(n: number, tags: string[] = []): ProjectDocument {
  const id = `d0000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
  return {
    id,
    project_id: PROJECT_ID,
    filename: `doc-${n}.pdf`,
    content_type: "application/pdf",
    size_bytes: 1024,
    kind: "pdf",
    uploaded_at: "2026-09-20T10:00:00Z",
    uploader_id: USER,
    download_url: `/api/v1/projects/${PROJECT_ID}/documents/${id}/download`,
    tags,
  };
}

function renderPanel(docs: ProjectDocument[], total = docs.length, initialTags: string[] = []) {
  return render(
    <DocumentsPanel
      projectId={PROJECT_ID}
      initialDocuments={docs}
      initialTotal={total}
      initialTags={initialTags}
      initialUploaders={[]}
      members={[]}
      currentUserId={USER}
      isAdminOrOwner
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  lastListProps = null;
  lastFiltersProps = null;
  vi.mocked(listDocumentUploadersAction).mockResolvedValue({ ok: true, data: [] });
  vi.mocked(listDocumentTagsAction).mockResolvedValue({ ok: true, data: [] });
  vi.mocked(deleteDocumentAction).mockResolvedValue({ ok: true, data: null });
});

describe("DocumentsPanel — deleting the last document of the last page", () => {
  it("steps back to the previous page instead of showing the empty state", async () => {
    const page1 = Array.from({ length: 25 }, (_, i) => makeDoc(i + 1));
    const doc26 = makeDoc(26);
    let deleted = false;
    vi.mocked(listDocumentsAction).mockImplementation(async (_p, params) => {
      const all = deleted ? page1 : [...page1, doc26];
      const page = params?.page ?? 1;
      const items = all.slice((page - 1) * 25, page * 25);
      return { ok: true, data: { items, total: all.length, page, per_page: 25 } };
    });
    vi.mocked(deleteDocumentAction).mockImplementation(async () => {
      deleted = true;
      return { ok: true, data: null };
    });

    renderPanel(page1, 26);
    fireEvent.click(await screen.findByRole("button", { name: "documents.pagination.next" }));
    fireEvent.click(await screen.findByRole("button", { name: "delete doc-26.pdf" }));
    fireEvent.click(screen.getByRole("button", { name: "confirm delete" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "delete doc-1.pdf" })).toBeInTheDocument()
    );
    expect(screen.queryByText("empty")).toBeNull();
    const calls = vi.mocked(listDocumentsAction).mock.calls;
    expect(calls[calls.length - 1][1]).toMatchObject({ page: 1 });
  });
});

describe("DocumentsPanel — sorting", () => {
  it("sorts a newly picked text column A→Z and a date column newest first", async () => {
    vi.mocked(listDocumentsAction).mockResolvedValue({
      ok: true,
      data: { items: [makeDoc(1)], total: 1, page: 1, per_page: 25 },
    });
    renderPanel([makeDoc(1)]);
    const list = screen.getByTestId("documents-list");

    lastListProps!.onSortChange("name");
    await waitFor(() => expect(list).toHaveAttribute("data-sort", "name:asc"));

    lastListProps!.onSortChange("uploader");
    await waitFor(() => expect(list).toHaveAttribute("data-sort", "uploader:asc"));

    lastListProps!.onSortChange("size");
    await waitFor(() => expect(list).toHaveAttribute("data-sort", "size:desc"));
  });
});

describe("DocumentsPanel — rename errors", () => {
  it("keeps the rename dialog open and explains a refused name", async () => {
    vi.mocked(listDocumentsAction).mockResolvedValue({
      ok: true,
      data: { items: [makeDoc(1)], total: 1, page: 1, per_page: 25 },
    });
    vi.mocked(renameDocumentAction).mockResolvedValue({
      ok: false,
      error: "validation",
      code: "INVALID_FILENAME",
    });
    renderPanel([makeDoc(1)]);

    fireEvent.click(screen.getByRole("button", { name: "rename doc-1.pdf" }));
    fireEvent.click(screen.getByRole("button", { name: "confirm rename" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("documents.rename.errorInvalid")
    );
    expect(screen.getByTestId("rename-dialog")).toBeInTheDocument();
  });
});

describe("DocumentsPanel — tag errors", () => {
  beforeEach(() => {
    vi.mocked(listDocumentsAction).mockResolvedValue({
      ok: true,
      data: { items: [makeDoc(1)], total: 1, page: 1, per_page: 25 },
    });
  });

  it("says a tag is too long instead of 'Failed to load documents'", async () => {
    vi.mocked(updateDocumentTagsAction).mockResolvedValue({
      ok: false,
      error: "validation",
      code: "TAG_TOO_LONG",
    });
    renderPanel([makeDoc(1)]);

    await lastListProps!.onTagsUpdate(makeDoc(1).id, ["short"]);

    expect(toast.error).toHaveBeenCalledWith("documents.tags.errorTooLong");
    expect(toast.error).not.toHaveBeenCalledWith("documents.toast.listLoadError");
  });

  it("refuses a 21st tag without calling the backend", async () => {
    renderPanel([makeDoc(1)]);
    const tags = Array.from({ length: 21 }, (_, i) => `t${i}`);

    await lastListProps!.onTagsUpdate(makeDoc(1).id, tags);

    expect(updateDocumentTagsAction).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("documents.tags.errorTooMany");
  });

  it("falls back to a tag-specific save error", async () => {
    vi.mocked(updateDocumentTagsAction).mockResolvedValue({ ok: false, error: "generic" });
    renderPanel([makeDoc(1)]);

    await lastListProps!.onTagsUpdate(makeDoc(1).id, ["a"]);

    expect(toast.error).toHaveBeenCalledWith("documents.tags.errorSave");
  });
});
