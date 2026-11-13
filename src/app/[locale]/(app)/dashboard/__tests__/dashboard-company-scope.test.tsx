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
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { permissions: ["project:view_budget"], companies: [{ id: "c-1", legal_name: "AVN", role: "admin", is_primary: true }] } }),
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
});

describe("DashboardPage — company scope", () => {
  it("switches to the company view and back to a project", async () => {
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
});
