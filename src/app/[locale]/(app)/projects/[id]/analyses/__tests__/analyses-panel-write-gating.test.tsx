/**
 * Analyses library write gating.
 *
 * Reading the library stays open to every project member, but uploading a
 * report needs effective `project:update` — the backend rejects the write
 * otherwise, so the upload trigger must not render for a member.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ---- Mocks ----

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: (ns: string) => (key: string, params?: Record<string, unknown>) => {
    const full = `${ns}.${key}`;
    if (!params) return full;
    return Object.entries(params).reduce<string>(
      (acc, [k, v]) => acc.replace(`{${k}}`, String(v)),
      full
    );
  },
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...rest }: { children: React.ReactNode }) => <a {...rest}>{children}</a>,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("../_actions/analyses-actions", () => ({
  listAnalysesAction: vi.fn().mockResolvedValue({
    ok: true,
    data: { items: [], total: 0, page: 1, per_page: 24 },
  }),
}));

vi.mock("../analysis-upload", () => ({
  AnalysisUpload: () => <div data-testid="analysis-upload" />,
}));

// ---- Imports after mocks ----

import { AnalysesPanel } from "../analyses-panel";

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
});

// ---- Tests ----

describe("AnalysesPanel — upload gating", () => {
  it("hides the upload control for a member (canManage=false)", () => {
    render(
      <AnalysesPanel
        projectId={PROJECT_ID}
        initialAnalyses={[]}
        initialTotal={0}
        availableTags={[]}
        members={[]}
        canManage={false}
      />
    );

    expect(screen.queryByTestId("analysis-upload")).toBeNull();
    // The read surface (search box) is still there.
    expect(screen.getByPlaceholderText("analyses.search.placeholder")).toBeInTheDocument();
  });

  it("shows the upload control for a manager (canManage=true)", () => {
    render(
      <AnalysesPanel
        projectId={PROJECT_ID}
        initialAnalyses={[]}
        initialTotal={0}
        availableTags={[]}
        members={[]}
        canManage
      />
    );

    expect(screen.getByTestId("analysis-upload")).toBeInTheDocument();
  });
});
