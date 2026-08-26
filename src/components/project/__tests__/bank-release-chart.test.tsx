/**
 * Unit tests for BankReleaseChart — the "Draw ledger" card (design 2b) shared
 * by the Overview dashboard and the Expense ledger.
 *
 * Covers the states the page tests don't: no credit recorded (with and
 * without draws), a normal draw-down, an over-drawn credit, the loading
 * placeholder, and the per-draw track / monthly bars / stats footer.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Invoice } from "@/types/invoice";
import { BankReleaseChart } from "../bank-release-chart";

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => {
    const plain = (key: string, params?: Record<string, unknown>) => {
      const full = namespace ? `${namespace}.${key}` : key;
      return params ? `${full}(${JSON.stringify(params)})` : full;
    };
    // t.rich renders as the bare key — tag chunks are style-only here.
    return Object.assign(plain, {
      rich: (key: string) => (namespace ? `${namespace}.${key}` : key),
    });
  },
  useLocale: () => "en",
}));

let seq = 0;
function makeRelease(overrides: Partial<Invoice> = {}): Invoice {
  seq += 1;
  return {
    id: `inv-${seq}`,
    project_id: "proj-1",
    invoice_number: `FR-2026-${String(seq).padStart(4, "0")}`,
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
  it("shows the remaining amount and headline meta when a credit is set", () => {
    render(
      <BankReleaseChart
        credit={200000}
        releasedTotal={75000}
        invoices={[makeRelease({ total_amount: 75000 })]}
      />
    );
    // 200 000 − 75 000, whole-euro fr-FR formatting (narrow no-break spaces).
    const remaining = screen.getByTestId("bank-release-remaining").textContent ?? "";
    expect(remaining.replace(/\s/g, "")).toBe("125000€");
    expect(screen.getByText("projects.bankRelease.headlineMeta")).toBeInTheDocument();
    expect(screen.queryByTestId("bank-release-no-credit")).not.toBeInTheDocument();
  });

  it("renders one track segment per draw plus the hatched remaining tail", () => {
    render(
      <BankReleaseChart
        credit={100000}
        releasedTotal={30000}
        invoices={[
          makeRelease({
            issue_date: "2026-01-10",
            total_amount: 20000,
            invoice_number: "FR-2026-0001",
          }),
          makeRelease({ issue_date: "2026-03-05", total_amount: 10000 }),
        ]}
      />
    );
    const track = screen.getByTestId("bank-release-track");
    // 2 draw segments + 1 remaining tail. Each segment gives back its 2px
    // flex gap so the hatched tail keeps its exact remaining share.
    expect(track.children).toHaveLength(3);
    expect((track.children[0] as HTMLElement).style.width).toBe("calc(20% - 2px)");
    expect((track.children[1] as HTMLElement).style.width).toBe("calc(10% - 2px)");
    // Each segment carries its draw's identity for the hover data-tip
    // (whitespace normalized — euro amounts use narrow no-break spaces).
    const tip = track.children[0].getAttribute("data-tip") ?? "";
    expect(tip.replace(/\s/g, "")).toBe("FR-2026-0001\u00b710/01/2026|20000\u20ac");
    expect(screen.getByText("projects.bankRelease.segmentHint")).toBeInTheDocument();
  });

  it("carries largest and last draw in the stats footer", () => {
    render(
      <BankReleaseChart
        credit={100000}
        releasedTotal={30000}
        invoices={[
          makeRelease({ issue_date: "2026-01-10", total_amount: 20000 }),
          makeRelease({ issue_date: "2026-03-05", total_amount: 10000 }),
        ]}
      />
    );
    const stats = screen.getByTestId("bank-release-stats");
    expect(stats).toHaveTextContent("projects.bankRelease.largestDraw");
    expect(stats).toHaveTextContent("projects.bankRelease.lastDraw");
    // Last draw shows its full DD/MM/YYYY date per the app-wide convention.
    expect(stats).toHaveTextContent("05/03/2026");
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

  it("keeps the draws meta and footer when no credit is recorded", () => {
    render(
      <BankReleaseChart
        credit={null}
        releasedTotal={20000}
        invoices={[makeRelease({ issue_date: "2026-01-10", total_amount: 20000 })]}
      />
    );
    expect(screen.getByTestId("bank-release-no-credit")).toBeInTheDocument();
    // No track without a credit denominator, but the header meta and the
    // largest/last stats still describe the draws that exist.
    expect(screen.queryByTestId("bank-release-track")).not.toBeInTheDocument();
    expect(screen.getByTestId("bank-release-stats")).toBeInTheDocument();
  });

  it("labels an over-drawn credit, shows the absolute overrun and drops the tail", () => {
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
    // Segment widths clamp to the pill; no hatched remaining tail.
    const track = screen.getByTestId("bank-release-track");
    expect(track.children).toHaveLength(1);
    expect((track.children[0] as HTMLElement).style.width).toBe("calc(100% - 2px)");
  });

  it("hides figures, track and stats while loading", () => {
    render(
      <BankReleaseChart
        credit={200000}
        releasedTotal={75000}
        invoices={[makeRelease({ total_amount: 75000 })]}
        loading
      />
    );
    expect(screen.getByTestId("bank-release-remaining")).toHaveTextContent("—");
    expect(screen.queryByTestId("bank-release-track")).not.toBeInTheDocument();
    expect(screen.queryByTestId("bank-release-stats")).not.toBeInTheDocument();
  });

  it("says so when a credit exists but nothing has been released", () => {
    render(<BankReleaseChart credit={200000} releasedTotal={0} invoices={[]} />);
    expect(screen.getByText("projects.bankRelease.noReleases")).toBeInTheDocument();
    // Track is a full-width hatch: no draw segments, only the remaining tail.
    expect(screen.getByTestId("bank-release-track").children).toHaveLength(1);
    expect(screen.queryByTestId("bank-release-stats")).not.toBeInTheDocument();
  });
});
