/**
 * DashboardPage — "Ledger desk" overview (design Canvas 3a).
 *
 * System time is pinned to Wed 2026-07-15 so "this month" (July) and the
 * agenda's "this week" (Mon 2026-07-13 → Sun 2026-07-19) are deterministic.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import type { Invoice } from "@/types/invoice";
import type { Task } from "@/types/task";
import type { Project } from "@/types/project";
import { formatEURWhole } from "@/lib/utils/formatters";
import DashboardPage from "../page";

// `formatEURWhole` uses fr-FR's narrow-no-break-space group/currency
// separators (U+202F / U+00A0); Testing Library's default text normalizer
// collapses the DOM's whitespace to plain spaces but does NOT touch the
// literal string passed to the matcher, so comparing the two directly always
// misses. Normalize both sides consistently instead.
const eur = (n: number) => formatEURWhole(n).replace(/[  ]/g, " ");

const mockFetchInvoicesWithMeta = vi.fn();
vi.mock("@/lib/api/invoice-api", () => ({
  fetchInvoicesWithMeta: (...args: unknown[]) => mockFetchInvoicesWithMeta(...args),
}));

const mockFetchTasks = vi.fn();
vi.mock("@/lib/api/task-api", () => ({
  fetchTasks: (...args: unknown[]) => mockFetchTasks(...args),
}));

const mockUseProject = vi.fn();
vi.mock("@/context/ProjectContext", () => ({
  useProject: () => mockUseProject(),
}));

function mkInvoice(partial: Partial<Invoice> & Pick<Invoice, "type" | "issue_date" | "total_amount">): Invoice {
  return {
    id: `inv-${Math.random()}`,
    project_id: "p-1",
    invoice_number: "INV-1",
    recipient_name: "Vendor",
    recipient_address: null,
    notes: null,
    items: [],
    created_by: "u-1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    payment_method_id: null,
    payment_method_label: null,
    source_billing_document_id: null,
    is_auto_generated: false,
    service_month: null,
    ...partial,
  };
}

function mkTask(partial: Partial<Task>): Task {
  return {
    id: `task-${Math.random()}`,
    project_id: "p-1",
    title: "Task",
    description: null,
    status: "todo",
    priority: "medium",
    assignee_id: null,
    due_date: null,
    position: 0,
    labels: [],
    created_by: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...partial,
  };
}

function renderDashboard() {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <DashboardPage />
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  // Fake only `Date` — faking timers wholesale would also stub setTimeout,
  // which the Testing Library `waitFor`/`findBy*` polling below relies on.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 6, 15, 12, 0, 0)); // Wed 2026-07-15
  vi.clearAllMocks();
  mockFetchInvoicesWithMeta.mockResolvedValue({ invoices: [], funds_released_total: 0, company_spent_total: 0, personal_spent_total: 0, company_name: null });
  mockFetchTasks.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("DashboardPage — no project selected", () => {
  it("renders a safe empty state without fetching", () => {
    mockUseProject.mockReturnValue({ selectedProject: null });
    renderDashboard();

    expect(mockFetchInvoicesWithMeta).not.toHaveBeenCalled();
    expect(mockFetchTasks).not.toHaveBeenCalled();
    // Zero-budget/zero-spend headline still renders.
    expect(screen.getAllByText(eur(0)).length).toBeGreaterThan(0);
    expect(screen.getByText("Nothing on the agenda this week.")).toBeInTheDocument();
  });
});

describe("DashboardPage — money panel figures", () => {
  const project: Partial<Project> = { id: "p-1", name: "Villa", budget: 4000 };

  beforeEach(() => {
    mockUseProject.mockReturnValue({ selectedProject: project });
    mockFetchInvoicesWithMeta.mockResolvedValue({
      invoices: [
        // July (current month) — company-paid labor.
        mkInvoice({ type: "labor", issue_date: "2026-07-05", total_amount: 500, paid_by_personal: false }),
        // June (previous month) — personal, still refundable.
        mkInvoice({
          type: "materials_services",
          issue_date: "2026-06-10",
          total_amount: 400,
          paid_by_personal: true,
          refundable_status: "refundable",
        }),
      ],
      funds_released_total: 5000,
      funds_released_company_total: 3500,
      funds_released_personal_total: 1500,
      company_spent_total: 500,
      personal_spent_total: 400,
      company_name: "Acme Co",
    });
    mockFetchTasks.mockResolvedValue([]);
  });

  it("shows credit remaining, this month's spend, and the purse figures", async () => {
    renderDashboard();
    const moneyPanel = within(await screen.findByTestId("overview-money-panel"));

    // spentTotal = 500 + 400 = 900; budget 4000 → left = 3100.
    await waitFor(() => expect(moneyPanel.getByText(eur(3100))).toBeInTheDocument());

    // Spent this month (July) = 500 — read via its label's sibling since the
    // company purse also happens to show "500 €" for its own spent figure.
    const spentThisMonthLabel = moneyPanel.getByText("Spent this month");
    expect(spentThisMonthLabel.nextElementSibling?.textContent).toBe(formatEURWhole(500));
    // +25% vs June (400 → 500).
    expect(moneyPanel.getByText(/\+25% vs Jun/)).toBeInTheDocument();

    // Pending refunds pill: 1 refundable expense, 400 €.
    expect(moneyPanel.getByText(new RegExp(`Pending refunds · ${eur(400)}`))).toBeInTheDocument();

    // Company purse: released 3500 (3500 = 5000 - 1500), spent 500 → left 3000.
    expect(moneyPanel.getByText(eur(3000))).toBeInTheDocument();
    // Personal purse: released 1500, spent 400 → left 1100.
    expect(moneyPanel.getByText(eur(1100))).toBeInTheDocument();
  });

  it("renders the per-type monthly totals on the shared-scale chart", async () => {
    renderDashboard();
    const typeMinis = within(await screen.findByTestId("overview-type-minis"));

    // Labor total (6-mo window) = 500, Materials & Services = 400.
    expect(await typeMinis.findByText(eur(500))).toBeInTheDocument();
    expect(typeMinis.getByText(eur(400))).toBeInTheDocument();
    expect(typeMinis.getByText("Labor")).toBeInTheDocument();
    expect(typeMinis.getByText("Materials & Services")).toBeInTheDocument();
  });
});

describe("DashboardPage — agenda grouping", () => {
  const project: Partial<Project> = { id: "p-1", name: "Villa" };

  it("groups non-done tasks into Overdue / Today / This week and excludes done/undated tasks", async () => {
    mockUseProject.mockReturnValue({ selectedProject: project });
    mockFetchTasks.mockResolvedValue([
      mkTask({ title: "Overdue thing", due_date: "2026-07-10" }),
      mkTask({ title: "Today thing", due_date: "2026-07-15" }),
      mkTask({ title: "Friday thing", due_date: "2026-07-17" }),
      mkTask({ title: "Next week thing", due_date: "2026-07-20" }),
      mkTask({ title: "Done thing", due_date: "2026-07-15", status: "done" }),
      mkTask({ title: "Undated thing", due_date: null }),
    ]);

    renderDashboard();

    expect(await screen.findByText("Overdue thing")).toBeInTheDocument();
    expect(screen.getByText("Today thing")).toBeInTheDocument();
    expect(screen.getByText("Friday thing")).toBeInTheDocument();
    expect(screen.queryByText("Next week thing")).toBeNull();
    expect(screen.queryByText("Done thing")).toBeNull();
    expect(screen.queryByText("Undated thing")).toBeNull();

    // Overdue task carries the "Overdue" stamp; the other groups don't repeat it as a stamp.
    const overdueStamps = screen.getAllByText("Overdue");
    expect(overdueStamps.length).toBeGreaterThan(0);
  });
});

describe("DashboardPage — project switch race (H1)", () => {
  it("ignores a stale response that resolves after switching to another project", async () => {
    const projectA: Partial<Project> = { id: "p-a", name: "Project A", budget: 1000 };
    const projectB: Partial<Project> = { id: "p-b", name: "Project B", budget: 2000 };

    let resolveA: (value: unknown) => void = () => {};
    const pendingA = new Promise((resolve) => {
      resolveA = resolve;
    });

    mockUseProject.mockReturnValue({ selectedProject: projectA });
    mockFetchInvoicesWithMeta.mockImplementation((pid: string) => {
      if (pid === "p-a") return pendingA;
      return Promise.resolve({
        invoices: [
          mkInvoice({ type: "labor", issue_date: "2026-07-05", total_amount: 200, paid_by_personal: false }),
        ],
        funds_released_total: 2000,
        company_spent_total: 200,
        personal_spent_total: 0,
        company_name: null,
      });
    });
    mockFetchTasks.mockResolvedValue([]);

    const { rerender } = renderDashboard();

    // Switch to project B before A's fetch has resolved.
    mockUseProject.mockReturnValue({ selectedProject: projectB });
    rerender(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <DashboardPage />
      </NextIntlClientProvider>
    );

    // B's headline lands: budget 2000, spent 200 → left 1800. Read via the
    // "Remaining" label's sibling — the raw figure also coincidentally
    // matches the company purse's "left" in this fixture.
    const moneyPanel = within(await screen.findByTestId("overview-money-panel"));
    const normalizeSpaces = (s: string) => s.replace(/[  ]/g, " ");
    const headlineValue = () =>
      normalizeSpaces(moneyPanel.getByText("Remaining").nextElementSibling?.textContent ?? "");
    await waitFor(() => expect(headlineValue()).toBe(eur(1800)));

    // A's stale response resolves late (budget 1000, spent 999 → left 1) — a
    // race would overwrite B's figures with A's; the cancelled-flag guard
    // must drop it instead.
    resolveA({
      invoices: [
        mkInvoice({ type: "labor", issue_date: "2026-07-05", total_amount: 999, paid_by_personal: false }),
      ],
      funds_released_total: 1000,
      company_spent_total: 999,
      personal_spent_total: 0,
      company_name: null,
    });
    // Let the (would-be) stale update's microtask chain fully drain before
    // asserting it never landed.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(headlineValue()).toBe(eur(1800));
  });
});
