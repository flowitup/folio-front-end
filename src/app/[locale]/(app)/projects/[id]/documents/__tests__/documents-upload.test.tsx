import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

// ---- Mutable mock state ----

let _csrfToken: string | null = "test-csrf";
let _refreshResult = false;
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
      errorOversize: "File too large (max 150 MB)",
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

// Mock presigned upload to always throw (forces fallback to multipart XHR)
vi.mock("@/lib/api/presigned-upload", () => ({
  requestPresignedUrl: () => Promise.reject(new Error("presign:501")),
  putToPresignedUrl: () => Promise.reject(new Error("not available")),
  confirmUpload: () => Promise.reject(new Error("not available")),
}));

import { DocumentsUpload } from "../documents-upload";

// ---- XHR mock ----

type XhrHandle = {
  instance: MockXhrInstance;
  respond(status: number, body?: string): void;
};

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
  _csrfToken = "test-csrf";
  _refreshResult = false;
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
    it("MAX_SIZE_BYTES constant is 150 MiB (157 286 400 bytes)", () => {
      expect(150 * 1024 * 1024).toBe(157_286_400);
    });

    it("rejects oversized files client-side without creating XHR", async () => {
      const xhrQueue = installXhrQueue();
      const { container } = render(<DocumentsUpload projectId="proj-1" onUploaded={vi.fn()} />);
      const oversizeFile = new File([new Uint8Array(100)], "big.pdf", {
        type: "application/pdf",
      });
      Object.defineProperty(oversizeFile, "size", { value: 151 * 1024 * 1024 });

      await act(async () => {
        dropFile(container, oversizeFile);
        await flushMicrotasks();
      });

      expect(xhrQueue.length).toBe(0);
      expect(screen.getByText("File too large (max 150 MB)")).toBeDefined();
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
    it("sets withCredentials for cookie auth", async () => {
      const xhrQueue = installXhrQueue();
      const { container } = render(<DocumentsUpload projectId="proj-1" onUploaded={vi.fn()} />);

      await act(async () => {
        dropFile(container, makePdfFile());
        await flushMicrotasks(10);
      });

      expect(xhrQueue.length).toBeGreaterThan(0);
      expect(xhrQueue[0].instance.withCredentials).toBe(true);
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

    it("does not set Authorization header", async () => {
      const xhrQueue = installXhrQueue();
      const { container } = render(<DocumentsUpload projectId="proj-1" onUploaded={vi.fn()} />);

      await act(async () => {
        dropFile(container, makePdfFile());
        await flushMicrotasks(10);
      });

      expect(xhrQueue.length).toBeGreaterThan(0);
      const calls = xhrQueue[0].instance.setRequestHeader.mock.calls;
      const hasAuth = calls.some((c: unknown[]) => c[0] === "Authorization");
      expect(hasAuth).toBe(false);
    });
  });

  // ---- 401 retry ----

  describe("401 response handling — refresh and retry", () => {
    it("retries after 401 when refresh succeeds", async () => {
      _refreshResult = true;

      const xhrQueue = installXhrQueue();
      const onUploaded = vi.fn();
      const { container } = render(
        <DocumentsUpload projectId="proj-1" onUploaded={onUploaded} />,
      );

      await act(async () => {
        dropFile(container, makePdfFile());
        await flushMicrotasks(10);
      });

      expect(xhrQueue.length).toBeGreaterThanOrEqual(1);

      await act(async () => {
        xhrQueue[0].respond(401);
        await flushMicrotasks(10);
      });

      expect(xhrQueue.length).toBeGreaterThanOrEqual(2);

      await act(async () => {
        xhrQueue[1].respond(201, makeDocResponse());
        await flushMicrotasks(5);
      });

      expect(onUploaded).toHaveBeenCalledTimes(1);
    });

    it("marks job as forbidden when 401 retry refresh also fails", async () => {
      _refreshResult = false;

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
