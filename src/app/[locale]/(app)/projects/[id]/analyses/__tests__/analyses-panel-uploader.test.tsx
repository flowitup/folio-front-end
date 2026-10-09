/**
 * Analyses library uploader names.
 *
 * A report uploaded by someone who is not a project member (a company admin
 * who was never assigned, platform ops) is named from the API's
 * `uploader_name`, not labelled "Former member"; that label is left for an
 * erased account.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { ProjectAnalysis } from "@/lib/api/project-analyses";

// ---- Mocks ----

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockListAnalyses = vi.fn();
vi.mock("../_actions/analyses-actions", () => ({
  listAnalysesAction: (...args: unknown[]) => mockListAnalyses(...args),
}));

vi.mock("../analysis-upload", () => ({
  AnalysisUpload: () => null,
}));

vi.mock("../analysis-card", () => ({
  AnalysisCard: ({ analysis, uploaderName }: { analysis: ProjectAnalysis; uploaderName: string }) => (
    <p data-testid={`uploader-${analysis.id}`}>{uploaderName}</p>
  ),
}));

// ---- Imports after mocks ----

import { AnalysesPanel } from "../analyses-panel";

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";

function makeAnalysis(id: string, uploaderId: string, uploaderName?: string | null): ProjectAnalysis {
  return {
    id,
    project_id: PROJECT_ID,
    uploader_id: uploaderId,
    ...(uploaderName === undefined ? {} : { uploader_name: uploaderName }),
    title: `Report ${id}`,
    summary: null,
    source_url: null,
    size_bytes: 100,
    tags: [],
    created_at: "2026-10-01T10:00:00Z",
    updated_at: "2026-10-01T10:00:00Z",
    content_url: `/api/v1/projects/${PROJECT_ID}/analyses/${id}/content`,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AnalysesPanel — uploader names", () => {
  it("names an unassigned uploader from the API and keeps 'Former member' for an erased account", async () => {
    const analyses = [
      makeAnalysis("a1", "u-admin2", "admin2@example.com"),
      makeAnalysis("a2", "u-member", null),
      makeAnalysis("a3", "u-member"),
      makeAnalysis("a4", "u-erased", null),
    ];
    mockListAnalyses.mockResolvedValue({
      ok: true,
      data: { items: analyses, total: analyses.length, page: 1, per_page: 24 },
    });

    render(
      <AnalysesPanel
        projectId={PROJECT_ID}
        initialAnalyses={analyses}
        initialTotal={analyses.length}
        availableTags={[]}
        members={[{ id: "u-member", name: "Alice Martin", email: "alice@example.com" }]}
        canManage={false}
      />
    );

    await waitFor(() => expect(mockListAnalyses).toHaveBeenCalled());
    // Not a project member, named by the API
    expect(screen.getByTestId("uploader-a1")).toHaveTextContent("admin2@example.com");
    // A member: the member list still names them when the API has no name
    expect(screen.getByTestId("uploader-a2")).toHaveTextContent("Alice Martin");
    expect(screen.getByTestId("uploader-a3")).toHaveTextContent("Alice Martin");
    // Erased account, unknown to the member list
    expect(screen.getByTestId("uploader-a4")).toHaveTextContent("analyses.card.unknownUploader");
  });
});
