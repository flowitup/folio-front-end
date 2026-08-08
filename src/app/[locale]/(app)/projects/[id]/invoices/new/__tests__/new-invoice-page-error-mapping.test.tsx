/**
 * Tests for NewInvoicePage — classifySubmitError arg wiring (review fix M-b)
 *
 * The page previously passed only 3 of classifySubmitError's args
 * (err, formatCapError, serviceMonthNotAllowedMessage), so the two newer
 * backend codes — worker_link_not_allowed / worker_not_in_project — fell
 * through to the raw backend message instead of the translated one. This
 * mirrors invoice-detail-content.tsx's edit-dialog call, which already
 * passed the full arg set.
 *
 * Strategy: mock InvoiceForm as a spy stub that exposes onSubmit via a
 * button, but keep the REAL classifySubmitError (partial module mock) so
 * the mapping itself is exercised, not just "some string" rendered.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const TRANSLATIONS: Record<string, string> = {
  newInvoice: "New invoice",
  errorRefundExceedsSource: "Refund exceeds remaining",
  errorServiceMonthNotAllowed: "Payment for month can only be set on labor expenses.",
  errorAppliedExceedsTarget: "The avoir amount exceeds the target invoice's total.",
  errorWorkerLinkNotAllowed: "A worker can only be linked on labor expenses.",
  errorWorkerNotInProject: "The selected worker is not part of this project.",
};

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => TRANSLATIONS[key] ?? key,
  useLocale: () => "en",
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "proj-1" }),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/api/invoice-api", () => ({
  createInvoice: vi.fn(),
}));

vi.mock("@/lib/api/projects", () => ({
  fetchProjectById: vi.fn().mockResolvedValue({ id: "proj-1", company_id: null }),
}));

vi.mock("@/lib/api/tags-client", () => ({
  fetchTagsClient: vi.fn().mockResolvedValue([]),
}));

// Keep the real classifySubmitError (that's what this fix is about) but
// replace InvoiceForm with a minimal stub that exposes onSubmit via a button.
vi.mock("@/components/invoices/invoice-form", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/invoices/invoice-form")>();
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    InvoiceForm: ({ onSubmit }: any) => (
      <button
        data-testid="submit-stub"
        onClick={() =>
          onSubmit({
            type: "labor",
            issue_date: "2026-06-01",
            recipient_name: "Some Worker",
            items: [],
          })
        }
      >
        submit
      </button>
    ),
  };
});

import NewInvoicePage from "../page";
import { createInvoice } from "@/lib/api/invoice-api";

const mockCreateInvoice = vi.mocked(createInvoice);

describe("NewInvoicePage — classifySubmitError arg wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("translates worker_link_not_allowed instead of showing raw backend text", async () => {
    mockCreateInvoice.mockRejectedValueOnce({
      data: { error: "worker_link_not_allowed", message: "raw backend text" },
    });

    render(<NewInvoicePage />);
    fireEvent.click(await screen.findByTestId("submit-stub"));

    await waitFor(() =>
      expect(
        screen.getByText("A worker can only be linked on labor expenses.")
      ).toBeDefined()
    );
    expect(screen.queryByText("raw backend text")).toBeNull();
  });

  it("translates worker_not_in_project instead of showing raw backend text", async () => {
    mockCreateInvoice.mockRejectedValueOnce({
      data: { error: "worker_not_in_project", message: "raw backend text" },
    });

    render(<NewInvoicePage />);
    fireEvent.click(await screen.findByTestId("submit-stub"));

    await waitFor(() =>
      expect(
        screen.getByText("The selected worker is not part of this project.")
      ).toBeDefined()
    );
    expect(screen.queryByText("raw backend text")).toBeNull();
  });

  it("still translates AppliedExceedsTarget (pre-existing arg, regression guard)", async () => {
    mockCreateInvoice.mockRejectedValueOnce({
      data: { error: "AppliedExceedsTarget", message: "raw backend text" },
    });

    render(<NewInvoicePage />);
    fireEvent.click(await screen.findByTestId("submit-stub"));

    await waitFor(() =>
      expect(
        screen.getByText("The avoir amount exceeds the target invoice's total.")
      ).toBeDefined()
    );
    expect(screen.queryByText("raw backend text")).toBeNull();
  });
});
