/**
 * Documents page access gate.
 *
 * Every documents route on the backend (list, read, preview, download and all
 * writes) requires effective `project:update`. The page therefore resolves the
 * project first and, for a caller without that permission, renders the
 * "not available" panel WITHOUT firing any documents request — otherwise the
 * member would land on a page full of 403 toasts.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("next-intl/server", () => ({
  getLocale: vi.fn().mockResolvedValue("en"),
  getTranslations: vi.fn().mockResolvedValue((key: string) => `documents.restricted.${key}`),
}));

vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/api/projects-server", () => ({
  getProjectById: vi.fn(),
}));

vi.mock("@/lib/api/project-documents", () => ({
  listProjectDocuments: vi.fn(),
  listDocumentTags: vi.fn(),
  listDocumentUploaders: vi.fn(),
}));

vi.mock("@/lib/api/members", () => ({
  listMembers: vi.fn(),
}));

const panelProps = vi.fn();

vi.mock("../documents-panel", () => ({
  DocumentsPanel: (props: Record<string, unknown>) => {
    panelProps(props);
    return <div data-testid="documents-panel" />;
  },
}));

// ── Imports after mocks ──────────────────────────────────────────────────────

import { getSession } from "@/lib/auth/session";
import { getProjectById } from "@/lib/api/projects-server";
import {
  listProjectDocuments,
  listDocumentTags,
  listDocumentUploaders,
} from "@/lib/api/project-documents";
import { listMembers } from "@/lib/api/members";
import DocumentsPage from "../page";

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";

function mockCaller(projectPerms: string[], globalPerms: string[] = ["project:read"]) {
  vi.mocked(getSession).mockResolvedValue({
    user: { id: "u-1", email: "member@example.com", permissions: globalPerms },
  } as unknown as Awaited<ReturnType<typeof getSession>>);
  vi.mocked(getProjectById).mockResolvedValue({
    id: PROJECT_ID,
    name: "Site A",
    my_permissions: projectPerms,
  } as unknown as Awaited<ReturnType<typeof getProjectById>>);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listProjectDocuments).mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    per_page: 25,
  } as unknown as Awaited<ReturnType<typeof listProjectDocuments>>);
  vi.mocked(listDocumentTags).mockResolvedValue([]);
  vi.mocked(listDocumentUploaders).mockResolvedValue([]);
  vi.mocked(listMembers).mockResolvedValue([]);
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("DocumentsPage — member without project:update", () => {
  it("renders the not-available panel instead of the documents panel", async () => {
    mockCaller(["project:read"]);

    render(await DocumentsPage({ params: Promise.resolve({ id: PROJECT_ID }) }));

    expect(screen.getByText("documents.restricted.title")).toBeInTheDocument();
    expect(screen.queryByTestId("documents-panel")).toBeNull();
  });

  it("never requests documents, tags, uploaders or members", async () => {
    mockCaller(["project:read"]);

    render(await DocumentsPage({ params: Promise.resolve({ id: PROJECT_ID }) }));

    expect(listProjectDocuments).not.toHaveBeenCalled();
    expect(listDocumentTags).not.toHaveBeenCalled();
    expect(listDocumentUploaders).not.toHaveBeenCalled();
    expect(listMembers).not.toHaveBeenCalled();
  });
});

describe("DocumentsPage — manager with project:update", () => {
  it("renders the documents panel and loads the list", async () => {
    mockCaller(["project:read", "project:update"]);

    render(await DocumentsPage({ params: Promise.resolve({ id: PROJECT_ID }) }));

    expect(screen.getByTestId("documents-panel")).toBeInTheDocument();
    expect(screen.queryByText("documents.restricted.title")).toBeNull();
    expect(listProjectDocuments).toHaveBeenCalledWith(PROJECT_ID);
  });

  it("hands the panel the documents' uploaders for the uploader filter", async () => {
    mockCaller(["project:read", "project:update"]);
    const uploaders = [{ user_id: "u-2", display_name: "Former Member" }];
    vi.mocked(listDocumentUploaders).mockResolvedValue(uploaders);

    render(await DocumentsPage({ params: Promise.resolve({ id: PROJECT_ID }) }));

    expect(listDocumentUploaders).toHaveBeenCalledWith(PROJECT_ID);
    expect(panelProps).toHaveBeenCalledWith(
      expect.objectContaining({ initialUploaders: uploaders })
    );
  });

  it("passes null uploaders when they cannot be read, so the panel retries", async () => {
    mockCaller(["project:read", "project:update"]);
    vi.mocked(listDocumentUploaders).mockRejectedValue(new Error("HTTP 500"));

    render(await DocumentsPage({ params: Promise.resolve({ id: PROJECT_ID }) }));

    expect(screen.getByTestId("documents-panel")).toBeInTheDocument();
    expect(panelProps).toHaveBeenCalledWith(expect.objectContaining({ initialUploaders: null }));
  });

  it("renders the documents panel for platform ops (wildcard permission)", async () => {
    mockCaller(["project:read"], ["*:*"]);

    render(await DocumentsPage({ params: Promise.resolve({ id: PROJECT_ID }) }));

    expect(screen.getByTestId("documents-panel")).toBeInTheDocument();
  });
});
