/**
 * Invoice print page — the "Print / Save PDF" view renders in the viewer's
 * language with euro amounts, like the rest of the invoices UI.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import frMessages from "@/messages/fr.json";
import type { Invoice } from "@/types/invoice";
import InvoicePrintPage from "../page";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "p1", invoiceId: "i1" }),
}));

const fetchInvoice = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/invoice-api", () => ({ fetchInvoice }));

const invoice = {
  id: "i1",
  project_id: "p1",
  invoice_number: "F-001",
  type: "labor",
  issue_date: "2026-09-15",
  service_month: "2026-08-01",
  recipient_name: "Jean Dupont",
  recipient_address: null,
  notes: null,
  items: [{ description: "Pose carrelage", quantity: 2, unit_price: 150, total: 300 }],
  total_amount: 300,
} as unknown as Invoice;

function renderFr() {
  return render(
    <NextIntlClientProvider locale="fr" messages={frMessages}>
      <InvoicePrintPage />
    </NextIntlClientProvider>,
  );
}

describe("InvoicePrintPage", () => {
  it("renders labels, type and service month in the active locale", async () => {
    fetchInvoice.mockResolvedValueOnce(invoice);
    renderFr();

    expect(await screen.findByText("F-001")).toBeDefined();
    expect(screen.getByText(frMessages.invoices.print.heading)).toBeDefined();
    expect(screen.getByText(frMessages.invoices.types.labor)).toBeDefined();
    expect(screen.getByText("août 2026")).toBeDefined();
    expect(screen.queryByText("Grand Total")).toBeNull();
    expect(screen.queryByText("Construction")).toBeNull();
  });

  it("formats amounts as euros", async () => {
    fetchInvoice.mockResolvedValueOnce(invoice);
    renderFr();

    await screen.findByText("F-001");
    // 300 € appears for the line total and the grand total.
    expect(screen.getAllByText(/300,00\s€/).length).toBe(2);
  });

  it("shows a translated error when the invoice cannot be loaded", async () => {
    fetchInvoice.mockRejectedValueOnce(new Error("boom"));
    renderFr();

    expect(await screen.findByText(frMessages.invoices.loadFailed)).toBeDefined();
  });
});
