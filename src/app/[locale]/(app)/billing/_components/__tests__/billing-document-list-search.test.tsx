/**
 * The list search only filters the loaded page(s): when older documents exist
 * it says so and keeps "Load more" reachable, even when nothing loaded matches.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { BillingDocumentList } from "../billing-document-list";
import type { BillingDocument } from "@/types/billing";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
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

describe("BillingDocumentList search", () => {
  it("keeps Load more when the search matches nothing loaded", () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <BillingDocumentList kind="devis" initialDocuments={[DOC]} initialTotal={70} />
      </NextIntlClientProvider>,
    );
    fireEvent.change(screen.getByPlaceholderText(enMessages.billing.list.searchPlaceholder), {
      target: { value: "DEV-2026-003" },
    });
    expect(screen.getByText(enMessages.billing.list.noResults)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Load more/ })).toBeInTheDocument();
    expect(screen.getByText(/Search covers the 1 most recent of 70 documents/)).toBeInTheDocument();
  });
});
