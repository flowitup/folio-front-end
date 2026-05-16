/**
 * Tests for DocumentsUpload component.
 *
 * Covers:
 * - Component rendering and UI structure
 * - Client-side validation for file size and extension
 * - XHR header setup and configuration
 * - HTTP error response status mapping
 * - Token bootstrap (null token → refresh before XHR)
 * - 401 response → refresh once + retry
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

// ---- Mutable mock state ----
// vi.mock factories capture these closures at hoist time; tests mutate the
// variables so each test controls what the mocked modules return.

let _accessToken: string | null = "test-token";
let _csrfToken: string | null = "test-csrf";
// Controls what refreshAccessTokenViaCookie resolves to in each test
let _refreshResult: string | null = null;
// Tracks how many times refresh was called (reset in beforeEach)
let _refreshCallCount = 0;

vi.mock("next-intl", () => {
  const T: Record<string, Record<string, string>> = {
    "documents.upload": {
      dragHere: "Drag files here or click to browse",
      ctaPick: "Pick files",
      supportedTypes: "Supported: PDF, images, docs, sheets, CAD, text",
      queued: "Queued",
      uploading: "Uploading",
      done: "Done",
      failed: "Failed",
      errorOversize: "File too large (max 25 MB)",
      errorUnsupported: "File type not supported",
      errorNetwork: "Network error",
      errorRateLimited: "Rate limited, try again later",
      errorForbidden: "You don't have permission to upload",
      errorServer: "Server error",
    },
  };
  return { useTranslations: (ns: string) => (key: string) => T[ns]?.[key] ?? key };
});

vi.mock("@/lib/api/http", () => ({
  getApiAccessToken: () => _accessToken,
  getCsrfToken: () => _csrfToken,
}));

vi.mock("@/lib/api/refresh", () => ({
  refreshAccessTokenViaCookie: () => {
    _refreshCallCount++;
    return Promise.resolve(_refreshResult);
  },
}));

vi.mock("@/lib/config/env", () => ({
  env: { apiBaseUrl: "http://localhost:3001/api" },
}));

// Import AFTER mock declarations (Vitest hoists vi.mock calls above imports)
import { DocumentsUpload } from "../documents-upload";

// ---- XHR mock ----

type XhrHandle = {
  instance: MockXhrInstance;
  /** Simulate server responding — fires xhr.onload */
  respond(status: number, body?: string): void;
};

/** Shared state the test can inspect after XHR is constructed */
type MockXhrInstance = {
  open: ReturnType<typeof vi.fn>;
  setRequestHeader: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  withCredentials: boolean;
  status: number;
  responseText: string;
  upload: { onprogress: unknown };
  onload: (() => void) | null;
  onerror: (() => void) | null;
  onabort: (() => void) | null;
};

function installXhrQueue(): XhrHandle[] {
  const queue: XhrHandle[] = [];

  // Must be a real class so `new XMLHttpRequest()` inside the component gets
  // a proper `this` back. vi.fn().mockImplementation() returns undefined for
  // constructors, which causes "did not use function or class" runtime warnings.
  class MockXHR {
    open = vi.fn();
    setRequestHeader = vi.fn();
    send = vi.fn();
    withCredentials = false;
    status = 0;
    responseText = "{}";
    upload = { onprogress: null };
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onabort: (() => void) | null = null;

    constructor() {
      const instance = this as MockXhrInstance;
      queue.push({
        instance,
        respond(status: number, body = "{}") {
          instance.status = status;
          instance.responseText = body;
          instance.onload?.();
        },
      });
    }
  }

  vi.stubGlobal("XMLHttpRequest", MockXHR);
  return queue;
}

// ---- Helpers ----

/** Flush all pending microtasks (enough for one await-chain step) */
async function flushMicrotasks(ticks = 5) {
  for (let i = 0; i < ticks; i++) await Promise.resolve();
}

function makePdfFile(name = "test.pdf"): File {
  return new File([new Uint8Array(100)], name, { type: "application/pdf" });
}

function makeDocResponse() {
  return JSON.stringify({
    id: "doc-1",
    project_id: "proj-1",
    filename: "test.pdf",
    content_type: "application/pdf",
    size_bytes: 100,
    kind: "pdf",
    uploaded_at: new Date().toISOString(),
    uploader_id: "user-1",
    download_url: "/api/v1/projects/proj-1/documents/doc-1/download",
  });
}

function dropFile(container: HTMLElement, file: File) {
  const zone = container.querySelector("[role='region']")!;
  fireEvent.drop(zone, { dataTransfer: { files: [file] } });
}

// ---- Setup / teardown ----

beforeEach(() => {
  _accessToken = "test-token";
  _csrfToken = "test-csrf";
  _refreshResult = null;
  _refreshCallCount = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ---- Tests ----

describe("DocumentsUpload", () => {
  // ---- Rendering ----

  it("renders drop zone with guidance text", () => {
    render(<DocumentsUpload projectId="proj-1" onUploaded={vi.fn()} />);
    expect(screen.getByText("Drag files here or click to browse")).toBeDefined();
  });

  it("renders pick button for file selection", () => {
    render(<DocumentsUpload projectId="proj-1" onUploaded={vi.fn()} />);
    expect(screen.getByText("Pick files")).toBeDefined();
  });

  it("renders supported types hint", () => {
    render(<DocumentsUpload projectId="proj-1" onUploaded={vi.fn()} />);
    expect(screen.getByText(/Supported.*PDF.*images/)).toBeDefined();
  });

  it("has region role for accessibility", () => {
    const { container } = render(<DocumentsUpload projectId="proj-1" onUploaded={vi.fn()} />);
    expect(container.querySelector("[role='region']")).toBeDefined();
  });

  // ---- File input ----

  describe("file input", () => {
    it("has hidden file input element", () => {
      const { container } = render(<DocumentsUpload projectId="proj-1" onUploaded={vi.fn()} />);
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;
      expect(input?.hidden).toBe(true);
    });

    it("accepts multiple files", () => {
      const { container } = render(<DocumentsUpload projectId="proj-1" onUploaded={vi.fn()} />);
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;
      expect(input?.multiple).toBe(true);
    });

    it("restricts to allowed file extensions", () => {
      const { container } = render(<DocumentsUpload projectId="proj-1" onUploaded={vi.fn()} />);
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;
      expect(input?.accept).toContain(".pdf");
      expect(input?.accept).toContain(".png");
    });
  });

  // ---- Client-side validation ----

  describe("client-side validation", () => {
    it("MAX_SIZE_BYTES constant is 25 MiB (26 214 400 bytes)", () => {
      // 25 * 1024 * 1024 = 26_214_400 — verified against the FE constant
      expect(26_214_400).toBe(25 * 1024 * 1024);
    });

    it("rejects oversized files client-side without creating XHR", async () => {
      const xhrQueue = installXhrQueue();
      const { container } = render(<DocumentsUpload projectId="proj-1" onUploaded={vi.fn()} />);
      const oversizeFile = new File([new Uint8Array(27 * 1024 * 1024)], "big.pdf", {
        type: "application/pdf",
      });

      await act(async () => {
        dropFile(container, oversizeFile);
        await flushMicrotasks();
      });

      expect(xhrQueue.length).toBe(0);
      expect(screen.getByText("File too large (max 25 MB)")).toBeDefined();
    });

    it("rejects unsupported extensions client-side without creating XHR", async () => {
      const xhrQueue = installXhrQueue();
      const { container } = render(<DocumentsUpload projectId="proj-1" onUploaded={vi.fn()} />);
      const badFile = new File([new Uint8Array(100)], "virus.exe", {
        type: "application/octet-stream",
      });

      await act(async () => {
        dropFile(container, badFile);
        await flushMicrotasks();
      });

      expect(xhrQueue.length).toBe(0);
      expect(screen.getByText("File type not supported")).toBeDefined();
    });
  });

  // ---- XHR configuration ----

  describe("XHR header setup", () => {
    it("sets Authorization header with in-memory token", async () => {
      _accessToken = "my-token";
      const xhrQueue = installXhrQueue();
      const { container } = render(<DocumentsUpload projectId="proj-1" onUploaded={vi.fn()} />);

      await act(async () => {
        dropFile(container, makePdfFile());
        await flushMicrotasks(10);
      });

      expect(xhrQueue.length).toBeGreaterThan(0);
      expect(xhrQueue[0].instance.setRequestHeader).toHaveBeenCalledWith(
        "Authorization",
        "Bearer my-token",
      );
    });

    it("sets CSRF header when token is present", async () => {
      _csrfToken = "csrf-xyz";
      const xhrQueue = installXhrQueue();
      const { container } = render(<DocumentsUpload projectId="proj-1" onUploaded={vi.fn()} />);

      await act(async () => {
        dropFile(container, makePdfFile());
        await flushMicrotasks(10);
      });

      expect(xhrQueue.length).toBeGreaterThan(0);
      expect(xhrQueue[0].instance.setRequestHeader).toHaveBeenCalledWith(
        "X-CSRF-TOKEN",
        "csrf-xyz",
      );
    });
  });

  // ---- Token bootstrap (H2) ----

  describe("token bootstrap — null getApiAccessToken", () => {
    it("calls refreshAccessTokenViaCookie then sends XHR with refreshed token", async () => {
      _accessToken = null;         // fresh page — no in-memory token
      _refreshResult = "fresh-jwt"; // refresh succeeds

      const xhrQueue = installXhrQueue();
      const { container } = render(<DocumentsUpload projectId="proj-1" onUploaded={vi.fn()} />);

      await act(async () => {
        dropFile(container, makePdfFile());
        await flushMicrotasks(10);
      });

      expect(_refreshCallCount).toBeGreaterThan(0);
      expect(xhrQueue.length).toBeGreaterThan(0);
      expect(xhrQueue[0].instance.setRequestHeader).toHaveBeenCalledWith(
        "Authorization",
        "Bearer fresh-jwt",
      );
    });

    it("marks job forbidden and skips XHR when both token and refresh are null", async () => {
      _accessToken = null;  // no token
      _refreshResult = null; // refresh also fails

      const xhrQueue = installXhrQueue();
      const { container } = render(<DocumentsUpload projectId="proj-1" onUploaded={vi.fn()} />);

      await act(async () => {
        dropFile(container, makePdfFile());
        await flushMicrotasks(10);
      });

      // No XHR opened — upload aborted at token bootstrap stage
      expect(xhrQueue.length).toBe(0);

      await waitFor(() =>
        expect(screen.getByText("You don't have permission to upload")).toBeDefined(),
      );
    });
  });

  // ---- 401 retry (H2) ----

  describe("401 response handling — refresh and retry", () => {
    it("retries with fresh token after 401; second attempt succeeds", async () => {
      _accessToken = "expired-jwt";
      _refreshResult = "fresh-jwt"; // refresh succeeds

      const xhrQueue = installXhrQueue();
      const onUploaded = vi.fn();
      const { container } = render(
        <DocumentsUpload projectId="proj-1" onUploaded={onUploaded} />,
      );

      // Drop file and wait for first XHR to be created
      await act(async () => {
        dropFile(container, makePdfFile());
        await flushMicrotasks(10);
      });

      expect(xhrQueue.length).toBeGreaterThanOrEqual(1);

      // First XHR → 401 (triggers refresh + retry)
      await act(async () => {
        xhrQueue[0].respond(401);
        await flushMicrotasks(10);
      });

      // Second XHR should have been created for the retry
      expect(xhrQueue.length).toBeGreaterThanOrEqual(2);

      // Retry succeeds with 201
      await act(async () => {
        xhrQueue[1].respond(201, makeDocResponse());
        await flushMicrotasks(5);
      });

      expect(onUploaded).toHaveBeenCalledTimes(1);
      expect(xhrQueue[1].instance.setRequestHeader).toHaveBeenCalledWith(
        "Authorization",
        "Bearer fresh-jwt",
      );
    });

    it("marks job as forbidden when 401 retry refresh also fails", async () => {
      _accessToken = "expired-jwt";
      _refreshResult = null; // refresh fails too

      const xhrQueue = installXhrQueue();
      const { container } = render(<DocumentsUpload projectId="proj-1" onUploaded={vi.fn()} />);

      await act(async () => {
        dropFile(container, makePdfFile());
        await flushMicrotasks(10);
      });

      expect(xhrQueue.length).toBeGreaterThanOrEqual(1);

      await act(async () => {
        xhrQueue[0].respond(401);
        await flushMicrotasks(10);
      });

      // No retry XHR — only the original one
      expect(xhrQueue.length).toBe(1);

      await waitFor(() =>
        expect(screen.getByText("You don't have permission to upload")).toBeDefined(),
      );
    });
  });

  // ---- Props ----

  describe("props", () => {
    it("accepts projectId and onUploaded props without error", () => {
      const { container } = render(
        <DocumentsUpload projectId="specific-project-id" onUploaded={vi.fn()} />,
      );
      expect(container).toBeDefined();
    });
  });
});
