/**
 * Tests for analyses server actions
 * Covers: input validation (UUIDs), error classification (413 → tooLarge, 400 → invalidFile, etc.)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Module mocks (must be before imports) ----

vi.mock("@/lib/api/project-analyses", () => ({
  listProjectAnalyses: vi.fn(),
  createProjectAnalysis: vi.fn(),
  updateProjectAnalysis: vi.fn(),
  deleteProjectAnalysis: vi.fn(),
}));

// next/navigation provides redirect (used by classifyBackendError on 401).
vi.mock("next/navigation", () => {
  return {
    redirect: vi.fn((url: string) => {
      throw new Error(`REDIRECT:${url}`);
    }),
  };
});

// revalidatePath lives in next/cache, NOT next/navigation. Mocking it on the
// wrong module leaves the real implementation in place, which throws outside a
// request context and makes every happy path look like a generic failure.
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// ---- Imports after mocks ----

const {
  listAnalysesAction,
  uploadAnalysisAction,
  updateAnalysisAction,
  deleteAnalysisAction,
} = await import("../analyses-actions");

const {
  listProjectAnalyses,
  createProjectAnalysis,
  updateProjectAnalysis,
  deleteProjectAnalysis,
} = await import("@/lib/api/project-analyses");

const mockListAnalyses = vi.mocked(listProjectAnalyses);
const mockCreateAnalysis = vi.mocked(createProjectAnalysis);
const mockUpdateAnalysis = vi.mocked(updateProjectAnalysis);
const mockDeleteAnalysis = vi.mocked(deleteProjectAnalysis);

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
const ANALYSIS_ID = "22222222-2222-2222-2222-222222222222";
const BAD_ID = "not-a-uuid";

// ---- listAnalysesAction ----

describe("listAnalysesAction", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("input validation", () => {
    it("rejects non-UUID projectId", async () => {
      const result = await listAnalysesAction(BAD_ID);
      expect(result).toEqual({ ok: false, error: "validation" });
      expect(mockListAnalyses).not.toHaveBeenCalled();
    });

    it("rejects empty projectId", async () => {
      const result = await listAnalysesAction("");
      expect(result).toEqual({ ok: false, error: "validation" });
      expect(mockListAnalyses).not.toHaveBeenCalled();
    });
  });

  describe("error mapping", () => {
    it("400 → invalidFile", async () => {
      mockListAnalyses.mockRejectedValueOnce(httpError(400));
      const result = await listAnalysesAction(PROJECT_ID);
      expect(result).toEqual({ ok: false, error: "invalidFile" });
    });

    it("403 → forbidden", async () => {
      mockListAnalyses.mockRejectedValueOnce(httpError(403));
      const result = await listAnalysesAction(PROJECT_ID);
      expect(result).toEqual({ ok: false, error: "forbidden" });
    });

    it("404 → notFound", async () => {
      mockListAnalyses.mockRejectedValueOnce(httpError(404));
      const result = await listAnalysesAction(PROJECT_ID);
      expect(result).toEqual({ ok: false, error: "notFound" });
    });

    it("429 → rateLimited", async () => {
      mockListAnalyses.mockRejectedValueOnce(httpError(429));
      const result = await listAnalysesAction(PROJECT_ID);
      expect(result).toEqual({ ok: false, error: "rateLimited" });
    });

    it("500 → generic", async () => {
      mockListAnalyses.mockRejectedValueOnce(httpError(500));
      const result = await listAnalysesAction(PROJECT_ID);
      expect(result).toEqual({ ok: false, error: "generic" });
    });

    it("422 → validation", async () => {
      mockListAnalyses.mockRejectedValueOnce(httpError(422));
      const result = await listAnalysesAction(PROJECT_ID);
      expect(result).toEqual({ ok: false, error: "validation" });
    });
  });

  describe("happy path", () => {
    it("calls listProjectAnalyses and returns data", async () => {
      const mockData = {
        items: [
          {
            id: ANALYSIS_ID,
            project_id: PROJECT_ID,
            title: "Report",
            summary: "A report",
            source_url: "https://example.com",
            uploader_id: "user-1",
            tags: ["tag1"],
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
            size_bytes: 1024,
            content_url: "/projects/proj/analyses/a/content",
          },
        ],
        total: 1,
        page: 1,
        per_page: 24,
      };
      mockListAnalyses.mockResolvedValueOnce(mockData);

      const result = await listAnalysesAction(PROJECT_ID);
      expect(result).toEqual({ ok: true, data: mockData });
      expect(mockListAnalyses).toHaveBeenCalledWith(PROJECT_ID, undefined);
    });

    it("passes params to listProjectAnalyses", async () => {
      const mockData = { items: [], total: 0, page: 1, per_page: 24 };
      mockListAnalyses.mockResolvedValueOnce(mockData);

      const params = { q: "search", tags: ["tag1"], page: 2, perPage: 10 };
      const result = await listAnalysesAction(PROJECT_ID, params);

      expect(mockListAnalyses).toHaveBeenCalledWith(PROJECT_ID, params);
      expect(result).toEqual({ ok: true, data: mockData });
    });
  });
});

// ---- uploadAnalysisAction ----

describe("uploadAnalysisAction", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("input validation", () => {
    it("rejects non-UUID projectId", async () => {
      const formData = new FormData();
      formData.append("file", new File([], "test.html"));
      formData.append("title", "Test");

      const result = await uploadAnalysisAction(BAD_ID, formData);
      expect(result).toEqual({ ok: false, error: "validation" });
      expect(mockCreateAnalysis).not.toHaveBeenCalled();
    });

    it("rejects empty projectId", async () => {
      const formData = new FormData();
      formData.append("file", new File([], "test.html"));
      formData.append("title", "Test");

      const result = await uploadAnalysisAction("", formData);
      expect(result).toEqual({ ok: false, error: "validation" });
      expect(mockCreateAnalysis).not.toHaveBeenCalled();
    });

    it("rejects missing file", async () => {
      const formData = new FormData();
      formData.append("title", "Test");

      const result = await uploadAnalysisAction(PROJECT_ID, formData);
      expect(result).toEqual({ ok: false, error: "invalidFile" });
      expect(mockCreateAnalysis).not.toHaveBeenCalled();
    });

    it("rejects empty file", async () => {
      const formData = new FormData();
      formData.append("file", new File([], "test.html", { type: "text/html" }));
      formData.append("title", "Test");

      const result = await uploadAnalysisAction(PROJECT_ID, formData);
      expect(result).toEqual({ ok: false, error: "invalidFile" });
      expect(mockCreateAnalysis).not.toHaveBeenCalled();
    });

    it("rejects missing title", async () => {
      const formData = new FormData();
      formData.append("file", new File([new Uint8Array(100)], "test.html"));

      const result = await uploadAnalysisAction(PROJECT_ID, formData);
      expect(result).toEqual({ ok: false, error: "validation" });
      expect(mockCreateAnalysis).not.toHaveBeenCalled();
    });

    it("rejects empty title", async () => {
      const formData = new FormData();
      formData.append("file", new File([new Uint8Array(100)], "test.html"));
      formData.append("title", "   "); // whitespace only

      const result = await uploadAnalysisAction(PROJECT_ID, formData);
      expect(result).toEqual({ ok: false, error: "validation" });
      expect(mockCreateAnalysis).not.toHaveBeenCalled();
    });
  });

  describe("error mapping", () => {
    it("413 → tooLarge (distinct from 400)", async () => {
      mockCreateAnalysis.mockRejectedValueOnce(httpError(413));

      const formData = new FormData();
      formData.append("file", new File([new Uint8Array(100)], "test.html"));
      formData.append("title", "Test");

      const result = await uploadAnalysisAction(PROJECT_ID, formData);
      expect(result).toEqual({ ok: false, error: "tooLarge" });
    });

    it("400 → invalidFile (distinct from 413)", async () => {
      mockCreateAnalysis.mockRejectedValueOnce(httpError(400));

      const formData = new FormData();
      formData.append("file", new File([new Uint8Array(100)], "test.html"));
      formData.append("title", "Test");

      const result = await uploadAnalysisAction(PROJECT_ID, formData);
      expect(result).toEqual({ ok: false, error: "invalidFile" });
    });

    it("403 → forbidden", async () => {
      mockCreateAnalysis.mockRejectedValueOnce(httpError(403));

      const formData = new FormData();
      formData.append("file", new File([new Uint8Array(100)], "test.html"));
      formData.append("title", "Test");

      const result = await uploadAnalysisAction(PROJECT_ID, formData);
      expect(result).toEqual({ ok: false, error: "forbidden" });
    });

    it("429 → rateLimited", async () => {
      mockCreateAnalysis.mockRejectedValueOnce(httpError(429));

      const formData = new FormData();
      formData.append("file", new File([new Uint8Array(100)], "test.html"));
      formData.append("title", "Test");

      const result = await uploadAnalysisAction(PROJECT_ID, formData);
      expect(result).toEqual({ ok: false, error: "rateLimited" });
    });
  });

  describe("happy path", () => {
    it("passes formData to createProjectAnalysis", async () => {
      const mockData = {
        id: ANALYSIS_ID,
        project_id: PROJECT_ID,
        title: "Test",
        summary: "",
        source_url: "",
        uploader_id: "user-1",
        tags: [],
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        size_bytes: 1024,
        content_url: "/projects/proj/analyses/a/content",
      };
      mockCreateAnalysis.mockResolvedValueOnce(mockData);

      const formData = new FormData();
      formData.append("file", new File([new Uint8Array(100)], "test.html"));
      formData.append("title", "Test");
      formData.append("summary", "A test");

      const result = await uploadAnalysisAction(PROJECT_ID, formData);

      expect(mockCreateAnalysis).toHaveBeenCalledWith(PROJECT_ID, formData);
      expect(result).toEqual({ ok: true, data: mockData });
    });
  });
});

// ---- updateAnalysisAction ----

describe("updateAnalysisAction", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("input validation", () => {
    it("rejects non-UUID projectId", async () => {
      const result = await updateAnalysisAction(BAD_ID, ANALYSIS_ID, { title: "New" });
      expect(result).toEqual({ ok: false, error: "validation" });
      expect(mockUpdateAnalysis).not.toHaveBeenCalled();
    });

    it("rejects non-UUID analysisId", async () => {
      const result = await updateAnalysisAction(PROJECT_ID, BAD_ID, { title: "New" });
      expect(result).toEqual({ ok: false, error: "validation" });
      expect(mockUpdateAnalysis).not.toHaveBeenCalled();
    });

    it("rejects empty title patch", async () => {
      const result = await updateAnalysisAction(PROJECT_ID, ANALYSIS_ID, { title: "  " });
      expect(result).toEqual({ ok: false, error: "validation" });
      expect(mockUpdateAnalysis).not.toHaveBeenCalled();
    });
  });

  describe("error mapping", () => {
    it("403 → forbidden", async () => {
      mockUpdateAnalysis.mockRejectedValueOnce(httpError(403));
      const result = await updateAnalysisAction(PROJECT_ID, ANALYSIS_ID, {
        summary: "Updated",
      });
      expect(result).toEqual({ ok: false, error: "forbidden" });
    });

    it("404 → notFound", async () => {
      mockUpdateAnalysis.mockRejectedValueOnce(httpError(404));
      const result = await updateAnalysisAction(PROJECT_ID, ANALYSIS_ID, {
        summary: "Updated",
      });
      expect(result).toEqual({ ok: false, error: "notFound" });
    });
  });

  describe("happy path", () => {
    it("passes patch to updateProjectAnalysis", async () => {
      const mockData = {
        id: ANALYSIS_ID,
        project_id: PROJECT_ID,
        title: "Original",
        summary: "Updated",
        source_url: "https://example.com",
        uploader_id: "user-1",
        tags: ["tag1"],
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-02T00:00:00Z",
        size_bytes: 1024,
        content_url: "/projects/proj/analyses/a/content",
      };
      mockUpdateAnalysis.mockResolvedValueOnce(mockData);

      const patch = { summary: "Updated" };
      const result = await updateAnalysisAction(PROJECT_ID, ANALYSIS_ID, patch);

      expect(mockUpdateAnalysis).toHaveBeenCalledWith(PROJECT_ID, ANALYSIS_ID, patch);
      expect(result).toEqual({ ok: true, data: mockData });
    });
  });
});

// ---- deleteAnalysisAction ----

describe("deleteAnalysisAction", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("input validation", () => {
    it("rejects non-UUID projectId", async () => {
      const result = await deleteAnalysisAction(BAD_ID, ANALYSIS_ID);
      expect(result).toEqual({ ok: false, error: "validation" });
      expect(mockDeleteAnalysis).not.toHaveBeenCalled();
    });

    it("rejects non-UUID analysisId", async () => {
      const result = await deleteAnalysisAction(PROJECT_ID, BAD_ID);
      expect(result).toEqual({ ok: false, error: "validation" });
      expect(mockDeleteAnalysis).not.toHaveBeenCalled();
    });
  });

  describe("error mapping", () => {
    it("403 → forbidden", async () => {
      mockDeleteAnalysis.mockRejectedValueOnce(httpError(403));
      const result = await deleteAnalysisAction(PROJECT_ID, ANALYSIS_ID);
      expect(result).toEqual({ ok: false, error: "forbidden" });
    });

    it("404 → notFound", async () => {
      mockDeleteAnalysis.mockRejectedValueOnce(httpError(404));
      const result = await deleteAnalysisAction(PROJECT_ID, ANALYSIS_ID);
      expect(result).toEqual({ ok: false, error: "notFound" });
    });
  });

  describe("happy path", () => {
    it("calls deleteProjectAnalysis and returns ok", async () => {
      mockDeleteAnalysis.mockResolvedValueOnce(undefined);

      const result = await deleteAnalysisAction(PROJECT_ID, ANALYSIS_ID);

      expect(mockDeleteAnalysis).toHaveBeenCalledWith(PROJECT_ID, ANALYSIS_ID);
      expect(result).toEqual({ ok: true });
    });
  });
});
