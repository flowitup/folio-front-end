/**
 * AssistantAuditPage — company-admin supervision log.
 *
 * Covers:
 * - A caller who admins no company is redirected to the app home and the audit
 *   endpoint is never called (defense-in-depth, mirrors documents-page-member-gating).
 * - A company admin sees the rows the wrapper returns (channel kind label, outcome
 *   badge, refused reason, cost).
 * - An empty result set renders the empty-state copy instead of an empty table.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(
    async ({ namespace }: { namespace: string }) =>
      (key: string) =>
        `${namespace}.${key}`
  ),
}));

vi.mock("@/lib/api/companies", () => ({
  fetchMyCompanies: vi.fn(),
  fetchAttachedUsers: vi.fn(),
}));

vi.mock("@/lib/api/assistant-audit", () => ({
  listAssistantAudit: vi.fn(),
}));

import { redirect } from "next/navigation";
import { fetchMyCompanies, fetchAttachedUsers } from "@/lib/api/companies";
import { listAssistantAudit } from "@/lib/api/assistant-audit";
import AssistantAuditPage from "../page";

const COMPANY_ID = "11111111-1111-1111-1111-111111111111";

function renderPage(searchParams: Record<string, string> = {}) {
  return AssistantAuditPage({
    params: Promise.resolve({ locale: "en" }),
    searchParams: Promise.resolve(searchParams),
  });
}

const adminCompany = {
  id: COMPANY_ID,
  legal_name: "Arcueil Construction",
  address: "1 rue de Paris",
  siret: null,
  tva_number: null,
  iban: null,
  bic: null,
  logo_url: null,
  default_payment_terms: null,
  prefix_override: null,
  created_by: "u-0",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  is_primary: true,
  attached_at: "2026-01-01T00:00:00Z",
  role: "admin" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchAttachedUsers).mockResolvedValue([]);
});

describe("AssistantAuditPage — non-admin", () => {
  it("redirects to the app home and never calls the audit endpoint", async () => {
    vi.mocked(fetchMyCompanies).mockResolvedValue([{ ...adminCompany, role: "member" }]);

    render(await renderPage());

    expect(redirect).toHaveBeenCalledWith("/en");
    expect(listAssistantAudit).not.toHaveBeenCalled();
  });
});

describe("AssistantAuditPage — company admin", () => {
  it("renders the rows the wrapper returns", async () => {
    vi.mocked(fetchMyCompanies).mockResolvedValue([adminCompany]);
    vi.mocked(listAssistantAudit).mockResolvedValue({
      items: [
        {
          id: "row-1",
          created_at: "2026-09-21T10:30:00Z",
          channel_key: `company:${COMPANY_ID}`,
          user_id: "u-1",
          user_name: "Minh",
          intent: "ask_material_status",
          feature: "material_lookup",
          outcome: "answered",
          refused_reason: null,
          cost_usd: 0.0042,
          trace_id: "trace-1",
        },
        {
          id: "row-2",
          created_at: "2026-09-21T11:00:00Z",
          channel_key: `admin:${COMPANY_ID}`,
          user_id: "u-2",
          user_name: "Tuan",
          intent: "ask_salary",
          feature: "payroll_lookup",
          outcome: "refused",
          refused_reason: "confidential_payroll",
          cost_usd: null,
          trace_id: "trace-2",
        },
      ],
    });

    render(await renderPage());

    expect(screen.getByText("assistantAudit.title")).toBeInTheDocument();
    expect(screen.getByText("Minh")).toBeInTheDocument();
    expect(screen.getByText("Tuan")).toBeInTheDocument();
    expect(screen.getByText("ask_material_status")).toBeInTheDocument();
    expect(screen.getByText("chat.kind.company")).toBeInTheDocument();
    expect(screen.getByText("chat.kind.admin")).toBeInTheDocument();
    expect(screen.getByText("assistantAudit.outcomes.answered")).toBeInTheDocument();
    expect(screen.getByText("assistantAudit.outcomes.refused")).toBeInTheDocument();
    expect(screen.getByText("confidential_payroll")).toBeInTheDocument();
    expect(screen.getByText("$0.0042")).toBeInTheDocument();
    // The row with no cost falls back to the em dash rather than "$0.00" or blank.
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("shows the empty state instead of an empty table", async () => {
    vi.mocked(fetchMyCompanies).mockResolvedValue([adminCompany]);
    vi.mocked(listAssistantAudit).mockResolvedValue({ items: [] });

    render(await renderPage());

    expect(screen.getByText("assistantAudit.empty")).toBeInTheDocument();
  });

  it("shows the load-error copy when the audit endpoint fails, not the empty state", async () => {
    vi.mocked(fetchMyCompanies).mockResolvedValue([adminCompany]);
    vi.mocked(listAssistantAudit).mockRejectedValue(new Error("boom"));

    render(await renderPage());

    expect(screen.getByText("assistantAudit.loadError")).toBeInTheDocument();
    expect(screen.queryByText("assistantAudit.empty")).toBeNull();
  });

  it("offers a user select from the attached-users wrapper when it loads", async () => {
    vi.mocked(fetchMyCompanies).mockResolvedValue([adminCompany]);
    vi.mocked(fetchAttachedUsers).mockResolvedValue([
      {
        user_id: "u-1",
        email: "minh@example.com",
        display_name: "Minh",
        phone: null,
        is_primary: false,
        attached_at: "2026-01-01T00:00:00Z",
        role: "member",
      },
    ]);
    vi.mocked(listAssistantAudit).mockResolvedValue({ items: [] });

    render(await renderPage());

    expect(screen.getByRole("combobox", { name: "assistantAudit.filters.user" })).toBeInTheDocument();
    expect(screen.getByText("Minh")).toBeInTheDocument();
  });

  it("falls back to a free-text user id field when the attached-users wrapper fails", async () => {
    vi.mocked(fetchMyCompanies).mockResolvedValue([adminCompany]);
    vi.mocked(fetchAttachedUsers).mockRejectedValue(new Error("boom"));
    vi.mocked(listAssistantAudit).mockResolvedValue({ items: [] });

    render(await renderPage());

    expect(
      screen.getByPlaceholderText("assistantAudit.filters.userIdPlaceholder")
    ).toBeInTheDocument();
  });

  it("renders '—' for a null intent, feature and outcome instead of an empty cell or Badge", async () => {
    vi.mocked(fetchMyCompanies).mockResolvedValue([adminCompany]);
    vi.mocked(listAssistantAudit).mockResolvedValue({
      items: [
        {
          id: "row-3",
          created_at: "2026-09-21T10:30:00Z",
          channel_key: `company:${COMPANY_ID}`,
          user_id: null,
          user_name: "?",
          intent: null,
          feature: null,
          outcome: null,
          refused_reason: null,
          cost_usd: null,
          trace_id: null,
        },
      ],
    });

    render(await renderPage());

    // cost and refused reason already fall back to "—" for null; intent, feature and
    // outcome (which used to render blank) must join them.
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(3);
  });
});

describe("AssistantAuditPage — Paris day bounds sent to the backend", () => {
  it("sends the from/to filter as Paris-midnight-bounded ISO instants, not the raw calendar dates", async () => {
    vi.mocked(fetchMyCompanies).mockResolvedValue([adminCompany]);
    vi.mocked(listAssistantAudit).mockResolvedValue({ items: [] });

    render(await renderPage({ from: "2026-09-20", to: "2026-09-23" }));

    expect(listAssistantAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "2026-09-19T22:00:00.000+00:00",
        to: "2026-09-23T21:59:59.999+00:00",
      })
    );
  });

  it("the default range's `to` bound covers everything up to now, including today's activity", async () => {
    vi.useFakeTimers();
    // 2026-09-23T13:00:00+02:00 Paris (CEST) = 11:00 UTC — mid-afternoon, well inside "today".
    vi.setSystemTime(new Date("2026-09-23T11:00:00.000Z"));
    try {
      vi.mocked(fetchMyCompanies).mockResolvedValue([adminCompany]);
      vi.mocked(listAssistantAudit).mockResolvedValue({ items: [] });

      render(await renderPage());

      const sentTo = vi.mocked(listAssistantAudit).mock.calls[0][0].to;
      expect(new Date(sentTo).getTime()).toBeGreaterThan(Date.now());
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("AssistantAuditPage — 200-row cap notice", () => {
  it("shows the limit notice when the result hits the 200-row cap", async () => {
    vi.mocked(fetchMyCompanies).mockResolvedValue([adminCompany]);
    vi.mocked(listAssistantAudit).mockResolvedValue({
      items: Array.from({ length: 200 }, (_, i) => ({
        id: `row-${i}`,
        created_at: "2026-09-21T10:30:00Z",
        channel_key: `company:${COMPANY_ID}`,
        user_id: "u-1",
        user_name: "Minh",
        intent: "ask_material_status",
        feature: "material_lookup",
        outcome: "answered",
        refused_reason: null,
        cost_usd: 0.001,
        trace_id: null,
      })),
    });

    render(await renderPage());

    expect(screen.getByTestId("assistant-audit-limit-notice")).toBeInTheDocument();
  });

  it("does not show the limit notice under the cap", async () => {
    vi.mocked(fetchMyCompanies).mockResolvedValue([adminCompany]);
    vi.mocked(listAssistantAudit).mockResolvedValue({
      items: [
        {
          id: "row-1",
          created_at: "2026-09-21T10:30:00Z",
          channel_key: `company:${COMPANY_ID}`,
          user_id: "u-1",
          user_name: "Minh",
          intent: "ask_material_status",
          feature: "material_lookup",
          outcome: "answered",
          refused_reason: null,
          cost_usd: 0.001,
          trace_id: null,
        },
      ],
    });

    render(await renderPage());

    expect(screen.queryByTestId("assistant-audit-limit-notice")).toBeNull();
  });
});
