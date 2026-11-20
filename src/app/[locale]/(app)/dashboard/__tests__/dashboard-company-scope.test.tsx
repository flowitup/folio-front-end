/**
 * DashboardPage — the Project / Company switch and the company view.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import type { Project } from "@/types/project";
import DashboardPage from "../page";

vi.mock("@/lib/api/invoice-api", () => ({
  fetchInvoicesWithMeta: vi.fn().mockResolvedValue({ invoices: [], funds_released_total: 0, company_spent_total: 0, personal_spent_total: 0 }),
}));
vi.mock("@/lib/api/task-api", () => ({ fetchTasks: vi.fn().mockResolvedValue([]) }));
vi.mock("@/lib/api/labor", () => ({
  fetchLaborMonthlySummary: vi.fn().mockResolvedValue({
    rows: [{ year: 2026, month: 7, total_days: 5, total_cost: 500, workers: [{ worker_id: "w1", worker_name: "Ân", days_worked: 5, total_cost: 500 }] }],
  }),
  fetchLaborPaymentsSummary: vi.fn().mockResolvedValue({ months: [] }),
}));

const mockSelectProject = vi.fn();
const project = (id: string, name: string, budget: number | null, spent: number): Project =>
  ({ id, name, address: null, owner_id: "u", user_count: 1, created_at: "", company_id: "c-1", budget, spent, spent_invoiced: spent, spent_personal: 0, my_permissions: ["project:view_budget"] }) as Project;
const projects = [project("p-1", "Nhà 13", 100000, 40000), project("p-2", "Nhà số 1", 50000, 60000)];

vi.mock("@/context/ProjectContext", () => ({
  useProject: () => ({ selectedProject: projects[0], projects, selectProject: mockSelectProject, isLoading: false }),
}));
const ADMIN = { permissions: ["project:view_budget"], companies: [{ id: "c-1", legal_name: "AVN", role: "admin", is_primary: true }] };
const MEMBER = { permissions: ["project:view_budget"], companies: [{ id: "c-1", legal_name: "AVN", role: "member", is_primary: true }] };
let mockUser: typeof ADMIN = ADMIN;
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: mockUser }),
}));

function renderDashboard() {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <DashboardPage />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  mockUser = ADMIN;
});

describe("DashboardPage — company scope", () => {
  it("switches to the company view and back to a project", async () => {
    window.localStorage.setItem("folio.overview.scope", "project");
    renderDashboard();
    fireEvent.click(within(screen.getByTestId("overview-scope-toggle")).getByRole("button", { name: "Company" }));

    expect(await screen.findByTestId("company-overview")).toBeInTheDocument();
    expect(window.localStorage.getItem("folio.overview.scope")).toBe("company");
    const cards = screen.getAllByTestId("company-project-card");
    // The overspent project comes first.
    expect(cards[0]).toHaveTextContent("Nhà số 1");
    expect(cards[0]).toHaveTextContent("Over budget");
    expect(screen.getByTestId("company-attention")).toHaveTextContent("Nhà số 1 over by");
    expect(await within(screen.getByTestId("company-wages")).findByText("Ân")).toBeInTheDocument();

    fireEvent.click(cards[1]);
    expect(mockSelectProject).toHaveBeenCalledWith("p-1");
    expect(screen.queryByTestId("company-overview")).toBeNull();
  });

  it("opens on the company view when it was the last choice", async () => {
    window.localStorage.setItem("folio.overview.scope", "company");
    renderDashboard();
    expect(await screen.findByTestId("company-overview")).toBeInTheDocument();
  });

  it("opens an admin with several projects on the company view when nothing is stored", async () => {
    renderDashboard();
    expect(await screen.findByTestId("company-overview")).toBeInTheDocument();
  });

  it("keeps the project view once an admin picked it", async () => {
    renderDashboard();
    await screen.findByTestId("company-overview");
    fireEvent.click(within(screen.getByTestId("overview-scope-toggle")).getByRole("button", { name: "Project" }));
    expect(window.localStorage.getItem("folio.overview.scope")).toBe("project");
    expect(screen.queryByTestId("company-overview")).toBeNull();
  });

  it("gives a member no company switch and no company figures", async () => {
    mockUser = MEMBER;
    renderDashboard();
    expect(await screen.findByTestId("overview-member-finances")).toBeInTheDocument();
    expect(screen.queryByTestId("overview-scope-toggle")).toBeNull();
    expect(screen.queryByTestId("company-overview")).toBeNull();
    expect(screen.queryByText("All wages for this month are paid.")).toBeNull();
  });

  it("falls back to the project view when a member has 'company' stored", async () => {
    mockUser = MEMBER;
    window.localStorage.setItem("folio.overview.scope", "company");
    renderDashboard();
    expect(await screen.findByTestId("overview-member-finances")).toBeInTheDocument();
    expect(screen.queryByTestId("company-overview")).toBeNull();
    expect(screen.queryByTestId("overview-scope-toggle")).toBeNull();
  });

  it("lists only the companies the user administers", async () => {
    mockUser = {
      permissions: ["project:view_budget"],
      companies: [
        { id: "c-1", legal_name: "AVN", role: "admin", is_primary: true },
        { id: "c-2", legal_name: "Other", role: "member", is_primary: false },
      ],
    };
    projects.push(project("p-3", "Nhà khác", null, 0));
    projects[2].company_id = "c-2";
    try {
      renderDashboard();
      expect(await screen.findByTestId("company-overview")).toBeInTheDocument();
      // One administered company: no company picker, and the other company's project is not added up.
      expect(screen.queryByRole("combobox", { name: "Company" })).toBeNull();
      expect(screen.getAllByTestId("company-project-card")).toHaveLength(2);
    } finally {
      projects.pop();
    }
  });

  it("says what period each figure covers on the company view", async () => {
    renderDashboard();
    const attention = await screen.findByTestId("company-attention");
    // July 2026: Ân worked 5 days (500 €) on each project, nothing paid yet.
    expect(await within(attention).findByText(/July 2026 wages: 1\s000 € still owed · 1 worker/)).toBeInTheDocument();
    // "Spent" is named as all-time, once.
    expect(screen.getAllByText("Spent to date")).toHaveLength(1);
    expect(screen.queryByText("Spent")).toBeNull();
    // The picker is labelled and has no gap after the first labor month.
    expect(screen.getByText("Days & wages:")).toBeInTheDocument();
    const options = within(screen.getByTestId("company-month-select")).getAllByRole("option").map((o) => (o as HTMLOptionElement).value);
    expect(options).toContain("2026-07");
    expect(options).toContain("2026-08");
    // The footnote sits right under the band.
    expect(screen.getByTestId("company-overview-band").nextElementSibling).toBe(screen.getByTestId("company-footnote"));
    // Worker line: days and what was paid, not days alone.
    expect(within(screen.getByTestId("company-wages")).getByText(/10 days · paid 0 €/)).toBeInTheDocument();
  });

  it("says a month without days has no days yet, not that all wages are paid", async () => {
    renderDashboard();
    const select = await screen.findByTestId("company-month-select");
    await within(screen.getByTestId("company-attention")).findByText(/still owed/);
    fireEvent.change(select, { target: { value: "2026-08" } });
    expect(await screen.findByTestId("company-wages-empty")).toHaveTextContent("No days logged this month.");
    expect(screen.getByTestId("company-attention")).not.toHaveTextContent("still owed");
  });
});
