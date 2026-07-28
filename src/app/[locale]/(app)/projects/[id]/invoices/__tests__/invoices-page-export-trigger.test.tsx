/**
 * Tests for InvoicesPage — export-range trigger button + dialog open/close
 * phase 07
 *
 * Covers:
 * - "Export range" button is rendered on the page header
 * - Clicking the button opens InvoiceExportDialog
 * - Active list tab type carries through as initialType prop
 *
 * Strategy: mock InvoiceExportDialog as a render-prop spy (data-testid).
 * Mock all hooks the page uses so it renders without a real Next.js router.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// ── Module mocks (must be hoisted before dynamic imports) ─────────────────────

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    if (params) {
      return Object.entries(params).reduce(
        (acc, [k, v]) => acc.replace(`{${k}}`, String(v)),
        key,
      );
    }
    return key;
  },
  useLocale: () => "en",
}));

vi.mock("next/navigation", () => ({
  useParams: vi.fn(),
  useSearchParams: vi.fn(),
  useRouter: vi.fn(),
  usePathname: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/context/ProjectContext", () => ({
  useProject: () => ({ projects: [] }),
}));

vi.mock("@/lib/api/invoice-api", () => ({
  fetchInvoicesWithMeta: vi.fn(),
  deleteInvoice: vi.fn(),
}));

// Spy-stub for InvoiceExportDialog — captures open + initialType props
vi.mock("@/components/invoices/invoice-export-dialog", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  InvoiceExportDialog: ({ open, initialType, onOpenChange }: any) =>
    open ? (
      <div
        data-testid="dialog-mock"
        data-initial-type={initialType ?? "all"}
      >
        <button
          data-testid="dialog-close"
          onClick={() => onOpenChange(false)}
        >
          close
        </button>
      </div>
    ) : null,
}));

// InvoiceDetailRow is only rendered for open invoice rows — stub it
vi.mock("@/components/invoices/invoice-detail-row", () => ({
  InvoiceDetailRow: () => <div data-testid="invoice-detail-row" />,
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { useParams, useSearchParams, useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { fetchInvoicesWithMeta } from "@/lib/api/invoice-api";
import InvoicesPage from "../page";

// ── Typed mock helpers ────────────────────────────────────────────────────────

const mockUseParams = vi.mocked(useParams);
const mockUseSearchParams = vi.mocked(useSearchParams);
const mockUseRouter = vi.mocked(useRouter);
const mockUsePathname = vi.mocked(usePathname);
const mockUseAuth = vi.mocked(useAuth);
const mockFetchInvoicesWithMeta = vi.mocked(fetchInvoicesWithMeta);

// ── Setup helpers ─────────────────────────────────────────────────────────────

function setupMocks() {
  mockUseParams.mockReturnValue({ id: "proj-test-1", locale: "en" });
  mockUseSearchParams.mockReturnValue(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { get: () => null, toString: () => "" } as any
  );
  mockUseRouter.mockReturnValue(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() } as any
  );
  mockUsePathname.mockReturnValue("/en/projects/proj-test-1/invoices");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockUseAuth.mockReturnValue({ user: { permissions: [] } } as any);
  mockFetchInvoicesWithMeta.mockResolvedValue({
    invoices: [],
    total: 0,
    funds_released_total: 0,
    funds_released_company_total: 0,
    funds_released_personal_total: 0,
    company_spent_total: 0,
    personal_spent_total: 0,
    company_name: null,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("InvoicesPage — export range trigger button", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  it("renders the Export range trigger button on the page", async () => {
    render(<InvoicesPage />);

    // The button text is the i18n key "export.trigger" → returns key as-is via mock
    await waitFor(
      () => {
        expect(screen.getByText("export.trigger")).toBeDefined();
      },
      { timeout: 5000 },
    );
  });

  it("dialog is not visible before the trigger button is clicked", async () => {
    render(<InvoicesPage />);

    await waitFor(
      () => {
        expect(screen.getByText("export.trigger")).toBeDefined();
      },
      { timeout: 5000 },
    );

    expect(screen.queryByTestId("dialog-mock")).toBeNull();
  });

  it("clicking the trigger button opens InvoiceExportDialog", async () => {
    render(<InvoicesPage />);

    await waitFor(
      () => {
        expect(screen.getByText("export.trigger")).toBeDefined();
      },
      { timeout: 5000 },
    );

    const triggerBtn = screen.getByText("export.trigger").closest("button")!;
    fireEvent.click(triggerBtn);

    expect(screen.getByTestId("dialog-mock")).toBeDefined();
  });
});

describe("InvoicesPage — initialType carries through from active tab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  it("dialog receives initialType='all' by default (no tab selected)", async () => {
    render(<InvoicesPage />);

    await waitFor(
      () => {
        expect(screen.getByText("export.trigger")).toBeDefined();
      },
      { timeout: 5000 },
    );

    fireEvent.click(screen.getByText("export.trigger").closest("button")!);

    const dialog = screen.getByTestId("dialog-mock");
    expect(dialog.getAttribute("data-initial-type")).toBe("all");
  });

  it("dialog receives initialType='labor' when labor tab is active", async () => {
    render(<InvoicesPage />);

    // Wait for page to render fully
    await waitFor(
      () => {
        expect(screen.getByText("export.trigger")).toBeDefined();
      },
      { timeout: 5000 },
    );

    // Click the "labor" tab — the tab button text is t("types.labor") → "types.labor" via mock
    const laborTab = screen.getAllByText("types.labor").find((el) => el.closest(".seg"))!;
    fireEvent.click(laborTab);

    // Now open the dialog
    fireEvent.click(screen.getByText("export.trigger").closest("button")!);

    const dialog = screen.getByTestId("dialog-mock");
    expect(dialog.getAttribute("data-initial-type")).toBe("labor");
  });

  it("dialog receives initialType='released_funds' when released-funds tab is active", async () => {
    render(<InvoicesPage />);

    await waitFor(
      () => {
        expect(screen.getByText("export.trigger")).toBeDefined();
      },
      { timeout: 5000 },
    );

    fireEvent.click(screen.getAllByText("types.released_funds").find((el) => el.closest(".seg"))!);
    fireEvent.click(screen.getByText("export.trigger").closest("button")!);

    const dialog = screen.getByTestId("dialog-mock");
    expect(dialog.getAttribute("data-initial-type")).toBe("released_funds");
  });

  it("dialog receives initialType='materials_services' when materials-services tab is active", async () => {
    render(<InvoicesPage />);

    await waitFor(
      () => {
        expect(screen.getByText("export.trigger")).toBeDefined();
      },
      { timeout: 5000 },
    );

    fireEvent.click(screen.getAllByText("types.materials_services").find((el) => el.closest(".seg"))!);
    fireEvent.click(screen.getByText("export.trigger").closest("button")!);

    const dialog = screen.getByTestId("dialog-mock");
    expect(dialog.getAttribute("data-initial-type")).toBe("materials_services");
  });
});

describe("InvoicesPage — dialog open/close state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  it("dialog closes when onOpenChange(false) is called", async () => {
    render(<InvoicesPage />);

    await waitFor(
      () => {
        expect(screen.getByText("export.trigger")).toBeDefined();
      },
      { timeout: 5000 },
    );

    // Open
    fireEvent.click(screen.getByText("export.trigger").closest("button")!);
    expect(screen.getByTestId("dialog-mock")).toBeDefined();

    // Close via dialog's internal close button (calls onOpenChange(false))
    fireEvent.click(screen.getByTestId("dialog-close"));
    expect(screen.queryByTestId("dialog-mock")).toBeNull();
  });
});
