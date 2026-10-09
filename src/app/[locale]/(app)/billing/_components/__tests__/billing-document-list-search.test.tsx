/**
 * The list search runs on the server (?q=), the list tells a failed load from
 * an empty one, and a row opens its document.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { BillingDocumentList } from "../billing-document-list";
import type { BillingDocument } from "@/types/billing";

const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockRefresh = vi.fn();
let mockSearch = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, refresh: mockRefresh }),
  useSearchParams: () => mockSearch,
  usePathname: () => "/en/billing/devis",
}));

vi.mock("@/app/[locale]/(app)/billing/_actions/billing-actions", () => ({
  importBillingDocumentAction: vi.fn(),
  deleteBillingDocumentAction: vi.fn(),
  convertDevisToFactureAction: vi.fn(),
}));

const DOC = {
  id: "doc-1",
  kind: "devis",
  document_number: "DEV-2026-070",
  status: "draft",
  recipient_name: "Dupont",
  issue_date: "2026-09-01",
  total_ttc: "120.00",
} as BillingDocument;

function renderList(props: Partial<React.ComponentProps<typeof BillingDocumentList>> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <BillingDocumentList kind="devis" initialDocuments={[DOC]} initialTotal={70} {...props} />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  mockSearch = new URLSearchParams();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("BillingDocumentList search", () => {
  it("sends the search to the server once typing pauses, back on page 1", () => {
    mockSearch = new URLSearchParams("page=3&status=draft");
    renderList();

    fireEvent.change(screen.getByPlaceholderText(enMessages.billing.list.searchPlaceholder), {
      target: { value: " DEV-2026-003 " },
    });
    expect(mockReplace).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(300));

    expect(mockReplace).toHaveBeenCalledWith(
      "/en/billing/devis?status=draft&q=DEV-2026-003",
      { scroll: false },
    );
  });

  it("shows the server's matches without filtering them again", () => {
    mockSearch = new URLSearchParams("q=dupont");
    renderList({ initialDocuments: [DOC], initialTotal: 1 });

    expect(screen.getAllByText("DEV-2026-070").length).toBeGreaterThan(0);
  });

  it("says no document matches a search", () => {
    mockSearch = new URLSearchParams("q=nothing");
    renderList({ initialDocuments: [], initialTotal: 0 });

    expect(screen.getByText(enMessages.billing.list.noResults)).toBeInTheDocument();
  });

  it("says no document has the status, rather than blaming a search, when only a status filters", () => {
    mockSearch = new URLSearchParams("status=accepted");
    renderList({ initialDocuments: [], initialTotal: 0 });

    expect(screen.getByText(enMessages.billing.list.noFilterResults)).toBeInTheDocument();
    expect(screen.queryByText(enMessages.billing.devis.list.empty.title)).toBeNull();
  });
});

describe("BillingDocumentList load failure", () => {
  it("shows an error with a retry instead of the first-run empty state", () => {
    renderList({ initialDocuments: [], initialTotal: 0, loadError: true });

    expect(screen.getByText(enMessages.billing.list.loadFailed)).toBeInTheDocument();
    expect(screen.queryByText(enMessages.billing.devis.list.empty.title)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: enMessages.billing.list.retry }));
    expect(mockRefresh).toHaveBeenCalled();
  });
});

describe("BillingDocumentList rows", () => {
  it("opens the document when its row is clicked", () => {
    renderList();

    fireEvent.click(screen.getAllByRole("link", { name: "DEV-2026-070" })[0]);

    expect(mockPush).toHaveBeenCalledWith("/en/billing/devis/doc-1");
  });

  it("shows a plural heading", () => {
    renderList();

    expect(screen.getByRole("heading", { name: "Quotes" })).toBeInTheDocument();
  });
});

describe("BillingDocumentList dates", () => {
  const savedTz = process.env.TZ;
  afterEach(() => {
    process.env.TZ = savedTz;
  });

  it("shows the stored issue date west of UTC, not the day before", () => {
    // The API sends calendar dates as RFC 1123 midnight GMT.
    process.env.TZ = "America/Cayenne";
    renderList({ initialDocuments: [{ ...DOC, issue_date: "Fri, 09 Oct 2026 00:00:00 GMT" }] });

    expect(screen.getAllByText("09/10/2026").length).toBe(2);
    expect(screen.queryByText("08/10/2026")).toBeNull();
  });
});
