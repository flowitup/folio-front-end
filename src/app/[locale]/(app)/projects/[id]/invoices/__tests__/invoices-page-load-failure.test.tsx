/**
 * Tests for InvoicesPage — a failed list load is one clear state.
 *
 * A project the caller cannot open (403) used to show the error alert AND the
 * "No expenses yet" card, the type tabs and the export button, as if the
 * ledger were simply empty.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ApiError } from "@/lib/api/http";

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => (key: string) => (namespace ? `${namespace}.${key}` : key),
  useLocale: () => "en",
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "proj-x", locale: "en" }),
  useSearchParams: () => ({ get: () => null, toString: () => "" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/en/projects/proj-x/invoices",
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { permissions: ["project:manage_labor", "project:view_budget"] } }),
}));

vi.mock("@/context/ProjectContext", () => ({
  useProject: () => ({ projects: [] }),
}));

vi.mock("@/lib/api/invoice-api", () => ({
  fetchInvoicesWithMeta: vi.fn(),
  deleteInvoice: vi.fn(),
}));

vi.mock("@/components/invoices/invoice-export-dialog", () => ({
  InvoiceExportDialog: () => null,
}));

vi.mock("@/lib/api/billing/refundable-invoices", () => ({
  setRefundableStatus: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { fetchInvoicesWithMeta } from "@/lib/api/invoice-api";
import InvoicesPage from "../page";

const mockFetch = vi.mocked(fetchInvoicesWithMeta);

beforeEach(() => vi.clearAllMocks());

describe("InvoicesPage — failed load", () => {
  it("says the project is out of reach, without the empty ledger, tabs or export", async () => {
    mockFetch.mockRejectedValue(new ApiError("HTTP 403: FORBIDDEN", 403, { error: "Forbidden" }));
    render(<InvoicesPage />);

    await waitFor(() => expect(screen.getByText("invoices.loadForbidden")).toBeInTheDocument());
    expect(screen.queryByText("invoices.noInvoices")).toBeNull();
    expect(screen.queryByText("invoices.all")).toBeNull();
    expect(screen.queryByText("invoices.export.trigger")).toBeNull();
  });

  it("keeps the generic message for a server failure, still without the empty card", async () => {
    mockFetch.mockRejectedValue(new ApiError("HTTP 500: INTERNAL SERVER ERROR", 500, {}));
    render(<InvoicesPage />);

    await waitFor(() => expect(screen.getByText("invoices.loadListFailed")).toBeInTheDocument());
    expect(screen.queryByText("invoices.noInvoices")).toBeNull();
  });

  it("still shows the empty card when the project simply has no expenses", async () => {
    mockFetch.mockResolvedValue({
      invoices: [],
      total: 0,
      funds_released_total: 0,
      funds_released_company_total: 0,
      funds_released_personal_total: 0,
      company_spent_total: 0,
      personal_spent_total: 0,
      company_name: null,
    } as never);
    render(<InvoicesPage />);

    await waitFor(() => expect(screen.getByText("invoices.noInvoices")).toBeInTheDocument());
    expect(screen.getByText("invoices.all")).toBeInTheDocument();
  });
});
