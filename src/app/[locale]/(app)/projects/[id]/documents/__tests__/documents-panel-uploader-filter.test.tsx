/**
 * DocumentsPanel — uploader filter.
 *
 * The "Uploaded by" select is fed by GET /documents/uploaders (who actually
 * has documents here: former members and unassigned company admins included),
 * not by the project assignments, and picking someone narrows the list on the
 * backend through `uploader_id`.
 *
 * The real DocumentsFilters is rendered (with the shadcn Select swapped for a
 * native <select>); the list, upload and dialogs are stubs exposing their props.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import type { DocumentUploader, ProjectDocument } from "@/lib/api/project-documents";

// ---- Module mocks ----

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

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (v: string) => void;
    children: React.ReactNode;
  }) => (
    <select aria-label="uploader" value={value} onChange={(e) => onValueChange(e.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

type ListStubProps = {
  documents: ProjectDocument[];
  members: { id: string; firstName?: string }[];
  filtered?: boolean;
  onDelete: (doc: ProjectDocument) => void;
};

const listProps = vi.fn();

vi.mock("../documents-list", () => ({
  DocumentsList: (props: ListStubProps) => {
    listProps(props);
    const names = new Map(props.members.map((m) => [m.id, m.firstName]));
    return (
      <ul data-testid="documents-list" data-filtered={String(Boolean(props.filtered))}>
        {props.documents.map((d) => (
          <li key={d.id}>
            {d.filename} — {names.get(d.uploader_id) ?? "(former member)"}
            <button type="button" onClick={() => props.onDelete(d)}>
              delete {d.filename}
            </button>
          </li>
        ))}
      </ul>
    );
  },
}));

let uploadedDoc: ProjectDocument | null = null;

vi.mock("../documents-upload", () => ({
  DocumentsUpload: ({ onUploaded }: { onUploaded: (doc: ProjectDocument) => void }) => (
    <button type="button" onClick={() => uploadedDoc && onUploaded(uploadedDoc)}>
      upload
    </button>
  ),
}));

vi.mock("../documents-preview-dialog", () => ({ DocumentsPreviewDialog: () => null }));
vi.mock("../documents-rename-dialog", () => ({ DocumentsRenameDialog: () => null }));

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

// ---- Imports after mocks ----

import { toast } from "sonner";
import {
  listDocumentsAction,
  deleteDocumentAction,
  listDocumentUploadersAction,
  listDocumentTagsAction,
} from "../actions";
import { DocumentsPanel } from "../documents-panel";

// ---- Fixtures ----

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const ALICE = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"; // assigned member
const BOB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"; // left the project, still has a document
const CAROL = "cccccccc-cccc-cccc-cccc-cccccccccccc"; // uploads for the first time

const UPLOADERS: DocumentUploader[] = [
  { user_id: ALICE, display_name: "Alice Martin" },
  { user_id: BOB, display_name: "Bob Former" },
];

function makeDoc(id: string, filename: string, uploaderId: string): ProjectDocument {
  return {
    id,
    project_id: PROJECT_ID,
    filename,
    content_type: "application/pdf",
    size_bytes: 1024,
    kind: "pdf",
    uploaded_at: "2026-09-20T10:00:00Z",
    uploader_id: uploaderId,
    download_url: `/api/v1/projects/${PROJECT_ID}/documents/${id}/download`,
    tags: [],
  };
}

const ALICE_DOC = makeDoc("d0000000-0000-0000-0000-000000000001", "plan.pdf", ALICE);
const BOB_DOC = makeDoc("d0000000-0000-0000-0000-000000000002", "devis.pdf", BOB);

function renderPanel(initialUploaders: DocumentUploader[] | null = UPLOADERS) {
  return render(
    <DocumentsPanel
      projectId={PROJECT_ID}
      initialDocuments={[ALICE_DOC, BOB_DOC]}
      initialTotal={2}
      initialTags={[]}
      initialUploaders={initialUploaders}
      members={[{ id: ALICE, firstName: "Alice Martin", email: "alice@example.com" }]}
      currentUserId={ALICE}
      isAdminOrOwner
    />
  );
}

function uploaderSelect() {
  return screen.getByLabelText("uploader") as HTMLSelectElement;
}

function lastListCall() {
  const calls = vi.mocked(listDocumentsAction).mock.calls;
  return calls[calls.length - 1];
}

beforeEach(() => {
  vi.clearAllMocks();
  uploadedDoc = null;
  vi.mocked(listDocumentsAction).mockImplementation(async (_projectId, params) => {
    const items =
      params?.uploaderId === BOB
        ? [BOB_DOC]
        : params?.uploaderId === ALICE
          ? [ALICE_DOC]
          : [ALICE_DOC, BOB_DOC];
    return { ok: true, data: { items, total: items.length, page: 1, per_page: 25 } };
  });
  vi.mocked(listDocumentUploadersAction).mockResolvedValue({ ok: true, data: UPLOADERS });
  vi.mocked(deleteDocumentAction).mockResolvedValue({ ok: true, data: null });
  vi.mocked(listDocumentTagsAction).mockResolvedValue({ ok: true, data: [] });
});

// ---- Tests ----

describe("DocumentsPanel — uploader filter options", () => {
  it("offers everyone who uploaded, including someone no longer assigned to the project", () => {
    renderPanel();

    const options = within(uploaderSelect())
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(options).toEqual(["documents.filter.anyUploader", "Alice Martin", "Bob Former"]);
  });

  it("names a former member's documents instead of showing '(former member)'", () => {
    renderPanel();

    expect(screen.getByText(/devis\.pdf — Bob Former/)).toBeInTheDocument();
    expect(screen.queryByText(/\(former member\)/)).toBeNull();
  });

  it("retries the uploaders from the client when the server could not read them", async () => {
    renderPanel(null);

    expect(listDocumentUploadersAction).toHaveBeenCalledWith(PROJECT_ID);
    await waitFor(() =>
      expect(within(uploaderSelect()).getByRole("option", { name: "Bob Former" })).toBeInTheDocument()
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("says so when the uploaders cannot be loaded at all", async () => {
    vi.mocked(listDocumentUploadersAction).mockResolvedValue({ ok: false, error: "generic" });

    renderPanel(null);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("documents.toast.uploadersLoadError")
    );
    // Only "Anyone" is left to pick; the list itself still loads.
    expect(within(uploaderSelect()).getAllByRole("option")).toHaveLength(1);
  });
});

describe("DocumentsPanel — filtering on the backend", () => {
  it("asks the backend for the chosen uploader's documents only", async () => {
    renderPanel();

    fireEvent.change(uploaderSelect(), { target: { value: BOB } });

    await waitFor(() =>
      expect(lastListCall()).toEqual([
        PROJECT_ID,
        expect.objectContaining({ uploaderId: BOB, page: 1 }),
      ])
    );
    await waitFor(() => expect(screen.queryByRole("button", { name: "delete plan.pdf" })).toBeNull());
    expect(screen.getByText(/devis\.pdf — Bob Former/)).toBeInTheDocument();
    expect(screen.getByTestId("documents-list")).toHaveAttribute("data-filtered", "true");
  });

  it("marks the list busy until the filtered page arrives", async () => {
    let resolveList: (() => void) | null = null;
    renderPanel();
    await waitFor(() => expect(listDocumentsAction).toHaveBeenCalled());

    vi.mocked(listDocumentsAction).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveList = () =>
            resolve({ ok: true, data: { items: [BOB_DOC], total: 1, page: 1, per_page: 25 } });
        })
    );
    fireEvent.change(uploaderSelect(), { target: { value: BOB } });

    const region = screen.getByTestId("documents-list-region");
    expect(region).toHaveAttribute("aria-busy", "true");

    resolveList!();
    await waitFor(() => expect(region).toHaveAttribute("aria-busy", "false"));
  });

  it("drops the uploader filter when 'Anyone' is picked again", async () => {
    renderPanel();

    fireEvent.change(uploaderSelect(), { target: { value: BOB } });
    await waitFor(() => expect(lastListCall()?.[1]).toMatchObject({ uploaderId: BOB }));

    fireEvent.change(uploaderSelect(), { target: { value: "__anyone__" } });
    await waitFor(() => expect(lastListCall()?.[1]?.uploaderId).toBeUndefined());
    expect(screen.getByTestId("documents-list")).toHaveAttribute("data-filtered", "false");
  });

  it("goes back to 'Anyone' once the selected uploader's last document is deleted", async () => {
    renderPanel();

    fireEvent.change(uploaderSelect(), { target: { value: BOB } });
    await waitFor(() => expect(screen.queryByRole("button", { name: "delete plan.pdf" })).toBeNull());

    // Bob no longer has anything here once his document is gone.
    vi.mocked(listDocumentUploadersAction).mockResolvedValue({
      ok: true,
      data: [UPLOADERS[0]],
    });
    fireEvent.click(screen.getByRole("button", { name: "delete devis.pdf" }));
    fireEvent.click(screen.getByRole("button", { name: "confirm delete" }));

    await waitFor(() => expect(uploaderSelect().value).toBe("__anyone__"));
    expect(listDocumentUploadersAction).toHaveBeenCalledWith(PROJECT_ID);
    await waitFor(() => expect(lastListCall()?.[1]?.uploaderId).toBeUndefined());
    expect(within(uploaderSelect()).queryByRole("option", { name: "Bob Former" })).toBeNull();
  });
});

describe("DocumentsPanel — uploads", () => {
  it("adds a first-time uploader to the filter", async () => {
    uploadedDoc = makeDoc("d0000000-0000-0000-0000-000000000003", "photo.pdf", CAROL);
    vi.mocked(listDocumentUploadersAction).mockResolvedValue({
      ok: true,
      data: [...UPLOADERS, { user_id: CAROL, display_name: "Carol New" }],
    });
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "upload" }));

    await waitFor(() =>
      expect(within(uploaderSelect()).getByRole("option", { name: "Carol New" })).toBeInTheDocument()
    );
  });

  it("keeps a new upload out of a list filtered on someone else", async () => {
    uploadedDoc = makeDoc("d0000000-0000-0000-0000-000000000005", "mine.pdf", ALICE);
    renderPanel();
    fireEvent.change(uploaderSelect(), { target: { value: BOB } });
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "delete plan.pdf" })).toBeNull()
    );

    fireEvent.click(screen.getByRole("button", { name: "upload" }));

    expect(toast.success).toHaveBeenCalledWith("documents.toast.uploadSuccess");
    expect(screen.queryByRole("button", { name: "delete mine.pdf" })).toBeNull();
  });

  it("does not reload the uploaders when the author is already listed", () => {
    uploadedDoc = makeDoc("d0000000-0000-0000-0000-000000000004", "notes.pdf", ALICE);
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "upload" }));

    expect(listDocumentUploadersAction).not.toHaveBeenCalled();
  });
});
