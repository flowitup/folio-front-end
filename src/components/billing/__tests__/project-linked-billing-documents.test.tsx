/**
 * Tests for ProjectLinkedBillingDocuments component.
 *
 * Verifies:
 *   - Renders rows with amount (TTC formatted as EUR) and status badge
 *   - Renders localized empty state when list is empty
 *   - Renders error state when fetch fails
 *   - Uses BillingStatusBadge for status display
 *   - Paid factures are filtered out (they are already mirrored as auto
 *     Released Funds expense rows and would appear as duplicates)
 *
 * Interaction strategy:
 *   - fetchProjectBillingDocuments is mocked at the module level
 *   - fireEvent only (no userEvent) — avoids fake-timer deadlocks
 *   - waitFor used to await async state updates after mount
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ProjectLinkedBillingDocuments } from "@/components/billing/project-linked-billing-documents";
import type { ProjectBillingDocumentSummary } from "@/types/billing";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/api/invoice-api", () => ({
  fetchProjectBillingDocuments: vi.fn(),
}));

vi.mock("next-intl", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const en = require("../../../messages/en.json") as Record<string, unknown>;
  function resolve(obj: Record<string, unknown>, path: string): string {
    return path.split(".").reduce<unknown>((acc, k) => {
      if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[k];
      return undefined;
    }, obj) as string ?? path;
  }
  const makeT = (ns: string) => (key: string, params?: Record<string, unknown>) => {
    let val = resolve(en, `${ns}.${key}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        val = val?.replace(`{${k}}`, String(v)) ?? val;
      });
    }
    return val ?? key;
  };
  return {
    useLocale: () => "en",
    useTranslations: (ns: string) => makeT(ns),
  };
});

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { fetchProjectBillingDocuments } from "@/lib/api/invoice-api";

const mockFetch = vi.mocked(fetchProjectBillingDocuments);

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

// A devis + a sent (non-paid) facture — both should be visible.
const DOCS: ProjectBillingDocumentSummary[] = [
  {
    id: "doc-1",
    kind: "devis",
    document_number: "TST-D-2026-0001",
    status: "accepted",
    issue_date: "2026-06-01",
    recipient_name: "Client ACME",
    total_ht: 600.0,
    total_ttc: 660.0,
  },
  {
    id: "doc-2",
    kind: "facture",
    document_number: "TST-F-2026-0002",
    status: "sent",
    issue_date: "2026-06-05",
    recipient_name: "Client Beta",
    total_ht: 1000.0,
    total_ttc: 1200.0,
  },
];

// A paid facture — should be filtered out (already represented as a FR expense row).
const PAID_FACTURE: ProjectBillingDocumentSummary = {
  id: "doc-3",
  kind: "facture",
  document_number: "TST-F-2026-0003",
  status: "paid",
  issue_date: "2026-06-10",
  recipient_name: "Client Gamma",
  total_ht: 2000.0,
  total_ttc: 2400.0,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ProjectLinkedBillingDocuments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders section heading", async () => {
    mockFetch.mockResolvedValue(DOCS);

    render(<ProjectLinkedBillingDocuments projectId="proj-1" />);

    await waitFor(() => {
      expect(screen.getByText("Linked quotes & invoices")).toBeDefined();
    });
  });

  it("renders a row for each visible document with document number", async () => {
    mockFetch.mockResolvedValue(DOCS);

    render(<ProjectLinkedBillingDocuments projectId="proj-1" />);

    await waitFor(() => {
      expect(screen.getByText("TST-D-2026-0001")).toBeDefined();
      expect(screen.getByText("TST-F-2026-0002")).toBeDefined();
    });
  });

  it("renders recipient names for visible documents", async () => {
    mockFetch.mockResolvedValue(DOCS);

    render(<ProjectLinkedBillingDocuments projectId="proj-1" />);

    await waitFor(() => {
      expect(screen.getByText("Client ACME")).toBeDefined();
      expect(screen.getByText("Client Beta")).toBeDefined();
    });
  });

  it("renders total_ttc amounts formatted as EUR", async () => {
    mockFetch.mockResolvedValue(DOCS);

    render(<ProjectLinkedBillingDocuments projectId="proj-1" />);

    await waitFor(() => {
      // 660 EUR formatted by fr-FR Intl: "660,00 €" or similar
      const cells = screen.getAllByText(/660/);
      expect(cells.length).toBeGreaterThan(0);

      const cells2 = screen.getAllByText(/1\s*200|1200/);
      expect(cells2.length).toBeGreaterThan(0);
    });
  });

  it("renders kind badges (Quote / Invoice)", async () => {
    mockFetch.mockResolvedValue(DOCS);

    render(<ProjectLinkedBillingDocuments projectId="proj-1" />);

    await waitFor(() => {
      expect(screen.getByText("Quote")).toBeDefined();
      expect(screen.getByText("Invoice")).toBeDefined();
    });
  });

  it("renders status badges for devis and sent factures (accepted → 'Accepted', sent → 'Sent')", async () => {
    mockFetch.mockResolvedValue(DOCS);

    render(<ProjectLinkedBillingDocuments projectId="proj-1" />);

    await waitFor(() => {
      expect(screen.getByText("Accepted")).toBeDefined();
      expect(screen.getByText("Sent")).toBeDefined();
    });
  });

  it("excludes paid factures (already represented as auto Released Funds expense rows)", async () => {
    // Mix: one devis + one paid facture. Only the devis should be visible.
    mockFetch.mockResolvedValue([DOCS[0], PAID_FACTURE]);

    render(<ProjectLinkedBillingDocuments projectId="proj-1" />);

    await waitFor(() => {
      // Devis is shown
      expect(screen.getByText("TST-D-2026-0001")).toBeDefined();
      // Paid facture is hidden
      expect(screen.queryByText("TST-F-2026-0003")).toBeNull();
      expect(screen.queryByText("Client Gamma")).toBeNull();
    });
  });

  it("shows empty state when all docs are paid factures", async () => {
    // All documents are paid factures — after filtering the list is empty.
    mockFetch.mockResolvedValue([PAID_FACTURE]);

    render(<ProjectLinkedBillingDocuments projectId="proj-1" />);

    await waitFor(() => {
      expect(
        screen.getByText("No billing documents are linked to this project yet.")
      ).toBeDefined();
    });
  });

  it("renders empty state when list is empty", async () => {
    mockFetch.mockResolvedValue([]);

    render(<ProjectLinkedBillingDocuments projectId="proj-1" />);

    await waitFor(() => {
      expect(
        screen.getByText("No billing documents are linked to this project yet.")
      ).toBeDefined();
    });
  });

  it("renders error message when fetch fails", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    render(<ProjectLinkedBillingDocuments projectId="proj-1" />);

    await waitFor(() => {
      expect(
        screen.getByText("Failed to load linked billing documents.")
      ).toBeDefined();
    });
  });

  it("calls fetchProjectBillingDocuments with the given projectId", async () => {
    mockFetch.mockResolvedValue([]);

    render(<ProjectLinkedBillingDocuments projectId="proj-xyz" />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("proj-xyz");
    });
  });
});
