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
});
