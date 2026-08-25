/**
 * Unit tests for BankReleaseChart — the "remaining to release from the bank"
 * card shared by the Overview dashboard and the Expense ledger.
 *
 * Covers the states the page tests don't: no credit recorded, a normal
 * draw-down, an over-drawn credit, and the loading placeholder.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Invoice } from "@/types/invoice";
import { BankReleaseChart } from "../bank-release-chart";

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) =>
    (key: string, params?: Record<string, unknown>) => {
      const full = namespace ? `${namespace}.${key}` : key;
      return params ? `${full}(${JSON.stringify(params)})` : full;
    },
  useLocale: () => "en",
}));

function makeRelease(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv-1",
    project_id: "proj-1",
    invoice_number: "INV-2026-0001",
    type: "released_funds",
    issue_date: "2026-06-01",
    recipient_name: "Bank",
    recipient_address: null,
    notes: null,
    items: [],
    total_amount: 20000,
    created_by: "user-1",
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    payment_method_id: null,
    payment_method_label: null,
    source_billing_document_id: null,
    is_auto_generated: false,
    refundable_status: null,
    service_month: null,
    ...overrides,
  };
}

describe("BankReleaseChart", () => {
  it("shows the remaining amount when a credit is set", () => {
    render(
      <BankReleaseChart
        credit={200000}
        releasedTotal={75000}
        invoices={[makeRelease({ total_amount: 75000 })]}
        source="Prêt BNP"
      />
    );
    // 200 000 − 75 000, whole-euro fr-FR formatting (narrow no-break spaces).
    const remaining = screen.getByTestId("bank-release-remaining").textContent ?? "";
    expect(remaining.replace(/\s/g, "")).toBe("125000€");
    expect(screen.getByText("Prêt BNP")).toBeInTheDocument();
    expect(screen.queryByTestId("bank-release-no-credit")).not.toBeInTheDocument();
  });

  it("prompts for the credit when none is recorded", () => {
    render(
      <BankReleaseChart
        credit={null}
        releasedTotal={0}
        invoices={[]}
        settingsHref="/en/projects/proj-1/settings"
      />
    );
    expect(screen.getByTestId("bank-release-no-credit")).toBeInTheDocument();
    expect(screen.queryByTestId("bank-release-remaining")).not.toBeInTheDocument();
    expect(
      screen.getByText("projects.bankRelease.openSettings").getAttribute("href")
    ).toBe("/en/projects/proj-1/settings");
  });

  it("labels an over-drawn credit and shows the absolute overrun", () => {
    render(
      <BankReleaseChart
        credit={100000}
        releasedTotal={130000}
        invoices={[makeRelease({ total_amount: 130000 })]}
      />
    );
    expect(screen.getByText("projects.bankRelease.overDrawn")).toBeInTheDocument();
    const remaining = screen.getByTestId("bank-release-remaining").textContent ?? "";
    expect(remaining.replace(/\s/g, "")).toBe("30000€");
  });

  it("renders one timeline bar per month between the first and last release", () => {
    render(
      <BankReleaseChart
        credit={100000}
        releasedTotal={30000}
        invoices={[
          makeRelease({ id: "a", issue_date: "2026-01-10", total_amount: 20000 }),
          makeRelease({ id: "b", issue_date: "2026-03-05", total_amount: 10000 }),
        ]}
      />
    );
    expect(screen.getByTestId("bank-release-bars").children).toHaveLength(3);
  });

  it("hides figures and the timeline while loading", () => {
    render(
      <BankReleaseChart
        credit={200000}
        releasedTotal={75000}
        invoices={[makeRelease({ total_amount: 75000 })]}
        loading
      />
    );
    expect(screen.getByTestId("bank-release-remaining")).toHaveTextContent("—");
    expect(screen.queryByTestId("bank-release-bars")).not.toBeInTheDocument();
  });

  it("says so when a credit exists but nothing has been released", () => {
    render(<BankReleaseChart credit={200000} releasedTotal={0} invoices={[]} />);
    expect(screen.getByText("projects.bankRelease.noReleases")).toBeInTheDocument();
  });
});
