/**
 * Invoice print page — the "Print / Save PDF" view renders in the viewer's
 * language with euro amounts, like the rest of the invoices UI.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import frMessages from "@/messages/fr.json";
import type { Invoice } from "@/types/invoice";
import InvoicePrintPage from "../page";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "p1", invoiceId: "i1" }),
}));

const fetchInvoice = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/invoice-api", () => ({ fetchInvoice }));
const fetchProjectById = vi.hoisted(() => vi.fn((): Promise<unknown> => Promise.reject(new Error("no project"))));
vi.mock("@/lib/api/projects", () => ({ fetchProjectById }));

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
  it("titles the tab after the expense and prints project, payment method and refund", async () => {
    fetchProjectById.mockResolvedValueOnce({ id: "p1", name: "QA3 interne", address: "12 rue des Lilas" });
    fetchInvoice.mockResolvedValueOnce({
      ...invoice,
      payment_method_label: "Carte Pro",
      refundable_status: "refund_pending",
    });
    renderFr();

    expect(await screen.findByText("QA3 interne · 12 rue des Lilas")).toBeDefined();
    await waitFor(() => expect(document.title).toBe("F-001 – Jean Dupont"));
    expect(screen.getByText(frMessages.invoices.print.project)).toBeDefined();
    expect(screen.getByText("Carte Pro")).toBeDefined();
    expect(screen.getByText(frMessages.invoices.refund.status.refundPending)).toBeDefined();
  });

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

  it("keeps the items table inside its own scroller on phone screens", async () => {
    fetchInvoice.mockResolvedValueOnce(invoice);
    const { container } = renderFr();

    await screen.findByText("F-001");
    const table = container.querySelector("table.items-table") as HTMLElement;
    expect(table.parentElement?.className).toBe("items-scroll");
    const css = container.querySelector("style")?.textContent ?? "";
    expect(css).toMatch(/\.items-scroll \{ overflow-x: auto;/);
    expect(css).toMatch(/@media screen and \(max-width: 640px\) \{[^@]*\.page \{ padding: 1rem; \}/);
  });

  it("shows a translated error when the invoice cannot be loaded", async () => {
    fetchInvoice.mockRejectedValueOnce(new Error("boom"));
    renderFr();

    expect(await screen.findByText(frMessages.invoices.print.loadError)).toBeDefined();
    // Not a dead end: a way back to the project's expenses.
    const back = screen.getByText(frMessages.invoices.print.back);
    expect(back.getAttribute("href")).toMatch(/^\/fr\/projects\/[^/]+\/invoices$/);
  });
});
