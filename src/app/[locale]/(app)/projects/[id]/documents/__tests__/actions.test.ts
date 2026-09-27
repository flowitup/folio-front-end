/**
 * Tests for documents server actions.
 * Mirrors notes/__tests__/actions.test.ts pattern.
 *
 * Covers:
 * - Input validation (UUID checks)
 * - Error mapping: 400, 403, 404, 429, 500
 * - Happy path for listDocumentsAction and deleteDocumentAction
 * - listDocumentUploadersAction (the uploader filter's options)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Module mocks (must be before imports) ----

vi.mock("@/lib/api/project-documents", () => ({
  listProjectDocuments: vi.fn(),
  deleteProjectDocument: vi.fn(),
  listDocumentUploaders: vi.fn(),
}));

// next/navigation is used by classifyBackendError (redirect on 401)
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("REDIRECT");
  }),
  revalidatePath: vi.fn(() => undefined),
}));

// ---- Imports after mocks ----

const { listDocumentsAction, deleteDocumentAction, listDocumentUploadersAction } =
  await import("../actions");
const { listProjectDocuments, deleteProjectDocument, listDocumentUploaders } = await import(
  "@/lib/api/project-documents"
);
import type { ProjectDocumentKind } from "@/lib/api/project-documents";

const mockListDocuments = vi.mocked(listProjectDocuments);
const mockDeleteDocument = vi.mocked(deleteProjectDocument);
const mockListUploaders = vi.mocked(listDocumentUploaders);

// ---- Helpers ----

function httpError(
  status: number,
  body: { error?: string; message?: string } | null = null
): Error & { status: number; body: typeof body } {
  const err = new Error(`HTTP ${status}`) as Error & {
    status: number;
    body: typeof body;
  };
  err.status = status;
  err.body = body;
  return err;
}

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const DOC_ID = "22222222-2222-2222-2222-222222222222";
const BAD_ID = "not-a-uuid";

// ---- listDocumentsAction ----

describe("listDocumentsAction — input validation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects non-UUID projectId", async () => {
    const result = await listDocumentsAction(BAD_ID);
    expect(result).toEqual({ ok: false, error: "validation", message: "Invalid project id" });
    expect(mockListDocuments).not.toHaveBeenCalled();
  });

  it("rejects empty projectId", async () => {
    const result = await listDocumentsAction("");
    expect(result).toEqual({ ok: false, error: "validation", message: "Invalid project id" });
    expect(mockListDocuments).not.toHaveBeenCalled();
  });
});

describe("listDocumentsAction — error mapping", () => {
  beforeEach(() => vi.clearAllMocks());

  it("400 → validation", async () => {
    mockListDocuments.mockRejectedValueOnce(httpError(400));
    const result = await listDocumentsAction(PROJECT_ID);
    expect(result).toEqual({ ok: false, error: "validation" });
  });

  it("403 → forbidden", async () => {
    mockListDocuments.mockRejectedValueOnce(httpError(403));
    const result = await listDocumentsAction(PROJECT_ID);
    expect(result).toEqual({ ok: false, error: "forbidden" });
  });

  it("404 → notFound", async () => {
    mockListDocuments.mockRejectedValueOnce(httpError(404));
    const result = await listDocumentsAction(PROJECT_ID);
    expect(result).toEqual({ ok: false, error: "notFound" });
  });

  it("429 → rateLimited", async () => {
    mockListDocuments.mockRejectedValueOnce(httpError(429));
    const result = await listDocumentsAction(PROJECT_ID);
    expect(result).toEqual({ ok: false, error: "rateLimited" });
  });

  it("500 → generic", async () => {
    mockListDocuments.mockRejectedValueOnce(httpError(500));
    const result = await listDocumentsAction(PROJECT_ID);
    expect(result).toEqual({ ok: false, error: "generic" });
  });
});

describe("listDocumentsAction — happy path", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls listProjectDocuments and returns data", async () => {
    const mockData = {
      items: [
        {
          id: DOC_ID,
          project_id: PROJECT_ID,
          filename: "test.pdf",
          content_type: "application/pdf",
          size_bytes: 1024,
          kind: "pdf" as const,
          uploaded_at: "2024-01-01T00:00:00Z",
          uploader_id: "user-1",
          download_url: "/api/v1/projects/11111111/documents/22222222/download",
          tags: [],
        },
      ],
      total: 1,
      page: 1,
      per_page: 20,
    };
    mockListDocuments.mockResolvedValueOnce(mockData);

    const result = await listDocumentsAction(PROJECT_ID);
    expect(mockListDocuments).toHaveBeenCalledWith(PROJECT_ID, undefined);
    expect(result).toEqual({ ok: true, data: mockData });
  });

  it("passes params to listProjectDocuments", async () => {
    const mockData = { items: [], total: 0, page: 1, per_page: 20 };
    mockListDocuments.mockResolvedValueOnce(mockData);

    const params = { kinds: ["pdf"] as ProjectDocumentKind[], page: 2 };
    const result = await listDocumentsAction(PROJECT_ID, params);

    expect(mockListDocuments).toHaveBeenCalledWith(PROJECT_ID, params);
    expect(result).toEqual({ ok: true, data: mockData });
  });

  it("forwards the uploader filter", async () => {
    mockListDocuments.mockResolvedValueOnce({ items: [], total: 0, page: 1, per_page: 25 });

    await listDocumentsAction(PROJECT_ID, { uploaderId: "33333333-3333-3333-3333-333333333333" });

    expect(mockListDocuments).toHaveBeenCalledWith(PROJECT_ID, {
      uploaderId: "33333333-3333-3333-3333-333333333333",
    });
  });
});

// ---- listDocumentUploadersAction ----

describe("listDocumentUploadersAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a non-UUID projectId without calling the API", async () => {
    const result = await listDocumentUploadersAction(BAD_ID);
    expect(result).toEqual({ ok: false, error: "validation", message: "Invalid project id" });
    expect(mockListUploaders).not.toHaveBeenCalled();
  });

  it("returns the uploaders the backend lists", async () => {
    const uploaders = [
      { user_id: "33333333-3333-3333-3333-333333333333", display_name: "Alice" },
      { user_id: "44444444-4444-4444-4444-444444444444", display_name: "bob@example.com" },
    ];
    mockListUploaders.mockResolvedValueOnce(uploaders);

    const result = await listDocumentUploadersAction(PROJECT_ID);

    expect(mockListUploaders).toHaveBeenCalledWith(PROJECT_ID);
    expect(result).toEqual({ ok: true, data: uploaders });
  });

  it("403 → forbidden", async () => {
    mockListUploaders.mockRejectedValueOnce(httpError(403));
    const result = await listDocumentUploadersAction(PROJECT_ID);
    expect(result).toEqual({ ok: false, error: "forbidden" });
  });

  it("500 → generic", async () => {
    mockListUploaders.mockRejectedValueOnce(httpError(500));
    const result = await listDocumentUploadersAction(PROJECT_ID);
    expect(result).toEqual({ ok: false, error: "generic" });
  });
});

// ---- deleteDocumentAction ----

describe("deleteDocumentAction — input validation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects non-UUID projectId", async () => {
    const result = await deleteDocumentAction(BAD_ID, DOC_ID);
    expect(result).toEqual({ ok: false, error: "validation", message: "Invalid project id" });
    expect(mockDeleteDocument).not.toHaveBeenCalled();
  });

  it("rejects empty projectId", async () => {
    const result = await deleteDocumentAction("", DOC_ID);
    expect(result).toEqual({ ok: false, error: "validation", message: "Invalid project id" });
    expect(mockDeleteDocument).not.toHaveBeenCalled();
  });

  it("rejects non-UUID docId", async () => {
    const result = await deleteDocumentAction(PROJECT_ID, BAD_ID);
    expect(result).toEqual({ ok: false, error: "validation", message: "Invalid document id" });
    expect(mockDeleteDocument).not.toHaveBeenCalled();
  });

  it("rejects empty docId", async () => {
    const result = await deleteDocumentAction(PROJECT_ID, "");
    expect(result).toEqual({ ok: false, error: "validation", message: "Invalid document id" });
    expect(mockDeleteDocument).not.toHaveBeenCalled();
  });
});

describe("deleteDocumentAction — error mapping", () => {
  beforeEach(() => vi.clearAllMocks());

  it("403 → forbidden", async () => {
    mockDeleteDocument.mockRejectedValueOnce(httpError(403));
    const result = await deleteDocumentAction(PROJECT_ID, DOC_ID);
    expect(result).toEqual({ ok: false, error: "forbidden" });
  });

  it("404 → notFound", async () => {
    mockDeleteDocument.mockRejectedValueOnce(httpError(404));
    const result = await deleteDocumentAction(PROJECT_ID, DOC_ID);
    expect(result).toEqual({ ok: false, error: "notFound" });
  });

  it("500 → generic", async () => {
    mockDeleteDocument.mockRejectedValueOnce(httpError(500));
    const result = await deleteDocumentAction(PROJECT_ID, DOC_ID);
    expect(result).toEqual({ ok: false, error: "generic" });
  });
});

