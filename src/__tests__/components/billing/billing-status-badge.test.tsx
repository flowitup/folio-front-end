/**
 * Tests for BillingStatusBadge component.
 * Verifies correct CSS class and label rendering per status.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BillingStatusBadge } from "@/components/billing/billing-status-badge";
import type { BillingDocumentStatus } from "@/types/billing";

const STATUS_CASES: Array<{ status: BillingDocumentStatus; label: string; colorHint: string }> = [
  { status: "draft",     label: "Draft",     colorHint: "slate" },
  { status: "sent",      label: "Sent",      colorHint: "blue" },
  { status: "accepted",  label: "Accepted",  colorHint: "green" },
  { status: "rejected",  label: "Rejected",  colorHint: "red" },
  { status: "expired",   label: "Expired",   colorHint: "amber" },
  { status: "paid",      label: "Paid",      colorHint: "green" },
  { status: "overdue",   label: "Overdue",   colorHint: "red" },
  { status: "cancelled", label: "Cancelled", colorHint: "zinc" },
];

describe("BillingStatusBadge", () => {
  it.each(STATUS_CASES)(
    "renders '$label' badge with $colorHint colour class for status=$status",
    ({ status, label, colorHint }) => {
      const { container } = render(
        <BillingStatusBadge status={status} label={label} />
      );
      const badge = container.querySelector("span");
      expect(badge).not.toBeNull();
      expect(badge!.textContent).toBe(label);
      expect(badge!.className).toContain(colorHint);
    }
  );

  it("renders the provided label text verbatim", () => {
    render(<BillingStatusBadge status="draft" label="Custom Label" />);
    expect(screen.getByText("Custom Label")).toBeDefined();
  });

  it("applies rounded-full pill styling", () => {
    const { container } = render(
      <BillingStatusBadge status="sent" label="Sent" />
    );
    const badge = container.querySelector("span");
    expect(badge!.className).toContain("rounded-full");
  });
});
