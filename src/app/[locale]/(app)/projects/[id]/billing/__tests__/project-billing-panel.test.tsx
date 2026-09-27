/**
 * ProjectBillingPanel — the quotes and invoices linked to one project.
 *
 * Verifies:
 *   - a loading status shows while the list is in flight
 *   - rows show number, kind, recipient, status, date and total TTC, and link
 *     to /billing/devis/<id> or /billing/factures/<id> by kind
 *   - the empty state explains how to link a document to the project
 *   - a failed load shows an error with "Try again", which refetches
 *   - a 403 shows the no-access message and no retry
 *
 * Mocking strategy: the API wrapper is a vi.fn(); next-intl resolves keys
 * against en.json so the assertions read real copy; the locale-aware Link is
 * a plain anchor.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ProjectBillingDocumentSummary } from "@/types/billing";

// ---------------------------------------------------------------------------
// Mocks (before component import)
// ---------------------------------------------------------------------------

vi.mock("@/lib/api/billing/project-billing-documents", () => ({
  fetchProjectBillingDocuments: vi.fn(),
}));

vi.mock("next-intl", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const en = require("../../../../../../../messages/en.json") as Record<string, unknown>;
  function resolve(path: string): string {
    const value = path.split(".").reduce<unknown>((acc, k) => {
      if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[k];
      return undefined;
    }, en);
    return typeof value === "string" ? value : path;
  }
  return {
    useLocale: () => "en",
    useTranslations: (ns: string) => (key: string) => resolve(`${ns}.${key}`),
  };
});

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    children,
    href,
    prefetch: _prefetch,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
    prefetch?: boolean;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ProjectBillingPanel } from "../project-billing-panel";
import { fetchProjectBillingDocuments } from "@/lib/api/billing/project-billing-documents";
import { ApiError } from "@/lib/api/http";

const mockFetch = fetchProjectBillingDocuments as unknown as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const QUOTE: ProjectBillingDocumentSummary = {
  id: "11111111-1111-4111-8111-111111111111",
  kind: "devis",
  document_number: "DEV-2026-004",
  status: "accepted",
  issue_date: "2026-09-12",
  recipient_name: "Famille Martin",
  total_ht: 10000,
  total_ttc: 12000,
};

const INVOICE: ProjectBillingDocumentSummary = {
  id: "22222222-2222-4222-8222-222222222222",
  kind: "facture",
  document_number: "FAC-2026-017",
  status: "overdue",
  issue_date: "2026-09-20",
  recipient_name: "SCI Les Pins",
  total_ht: 2500.5,
  total_ttc: 3000.6,
};

const PROJECT_ID = "33333333-3333-4333-8333-333333333333";

/**
 * Total as the page renders it (fr-FR EUR), with its no-break spaces collapsed
 * the way Testing Library's default text normalizer collapses the DOM text.
 */
function eur(n: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" })
    .format(n)
    .replace(/\s+/g, " ");
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ProjectBillingPanel", () => {
  it("shows a loading status while the list is in flight", () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<ProjectBillingPanel projectId={PROJECT_ID} />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading quotes and invoices…");
    expect(mockFetch).toHaveBeenCalledWith(PROJECT_ID, expect.any(AbortSignal));
  });

  it("lists each document with its kind, recipient, status, date and total", async () => {
    mockFetch.mockResolvedValue([INVOICE, QUOTE]);
    render(<ProjectBillingPanel projectId={PROJECT_ID} />);

    const table = await screen.findByRole("table");
    const rows = within(table).getAllByRole("row");
    // header + 2 documents, backend order kept (newest first)
    expect(rows).toHaveLength(3);

    const invoiceRow = rows[1];
    expect(within(invoiceRow).getByText("FAC-2026-017")).toBeInTheDocument();
    expect(within(invoiceRow).getByText("Invoice")).toBeInTheDocument();
    expect(within(invoiceRow).getByText("SCI Les Pins")).toBeInTheDocument();
    expect(within(invoiceRow).getByText("Overdue")).toBeInTheDocument();
    expect(within(invoiceRow).getByText("20/09/2026")).toBeInTheDocument();
    expect(within(invoiceRow).getByText(eur(3000.6))).toBeInTheDocument();

    const quoteRow = rows[2];
    expect(within(quoteRow).getByText("Quote")).toBeInTheDocument();
    expect(within(quoteRow).getByText("Accepted")).toBeInTheDocument();
    expect(within(quoteRow).getByText(eur(12000))).toBeInTheDocument();

    expect(screen.queryByRole("status")).toBeNull();
  });

  it("links quotes to /billing/devis/<id> and invoices to /billing/factures/<id>", async () => {
    mockFetch.mockResolvedValue([QUOTE, INVOICE]);
    render(<ProjectBillingPanel projectId={PROJECT_ID} />);

    await screen.findByRole("table");
    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    // Phone card + desktop row per document.
    expect(hrefs.filter((h) => h === `/billing/devis/${QUOTE.id}`)).toHaveLength(2);
    expect(hrefs.filter((h) => h === `/billing/factures/${INVOICE.id}`)).toHaveLength(2);
    expect(hrefs).toHaveLength(4);
  });

  it("shows the empty state when no document is linked to the project", async () => {
    mockFetch.mockResolvedValue([]);
    render(<ProjectBillingPanel projectId={PROJECT_ID} />);

    expect(await screen.findByText("No quotes or invoices yet")).toBeInTheDocument();
    expect(
      screen.getByText(/Choose this project in the “Project” field of a quote or invoice/)
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows an error with a retry that refetches the list", async () => {
    mockFetch
      .mockRejectedValueOnce(new ApiError("HTTP 500", 500))
      .mockResolvedValueOnce([QUOTE]);
    const user = userEvent.setup();
    render(<ProjectBillingPanel projectId={PROJECT_ID} />);

    expect(
      await screen.findByText("Couldn't load the quotes and invoices for this project.")
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Try again/ }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(
      screen.queryByText("Couldn't load the quotes and invoices for this project.")
    ).toBeNull();
  });

  it("shows the no-access message without a retry on 403", async () => {
    mockFetch.mockRejectedValue(new ApiError("HTTP 403", 403));
    render(<ProjectBillingPanel projectId={PROJECT_ID} />);

    expect(
      await screen.findByText("You don't have access to this project's quotes and invoices.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Try again/ })).toBeNull();
  });
});
