/**
 * Tests for BillingStatusBadge component.
 * Verifies correct Folio stamp variant and label rendering per status.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BillingStatusBadge } from "@/components/billing/billing-status-badge";
import type { BillingDocumentStatus } from "@/types/billing";

const STATUS_CASES: Array<{ status: BillingDocumentStatus; label: string; variant: string }> = [
  { status: "draft",     label: "Draft",     variant: "stamp" },
  { status: "sent",      label: "Sent",      variant: "accent" },
  { status: "accepted",  label: "Accepted",  variant: "positive" },
  { status: "rejected",  label: "Rejected",  variant: "negative" },
  { status: "expired",   label: "Expired",   variant: "warning" },
  { status: "paid",      label: "Paid",      variant: "positive" },
  { status: "overdue",   label: "Overdue",   variant: "negative" },
  { status: "cancelled", label: "Cancelled", variant: "stamp" },
];

describe("BillingStatusBadge", () => {
  it.each(STATUS_CASES)(
    "renders '$label' badge with '$variant' stamp variant for status=$status",
    ({ status, label, variant }) => {
      const { container } = render(
        <BillingStatusBadge status={status} label={label} />
      );
      const badge = container.querySelector("span");
      expect(badge).not.toBeNull();
      expect(badge!.textContent).toBe(label);
      expect(badge!.className).toContain("stamp");
      expect(badge!.className).toContain(variant);
    }
  );

  it("renders the provided label text verbatim", () => {
    render(<BillingStatusBadge status="draft" label="Custom Label" />);
    expect(screen.getByText("Custom Label")).toBeDefined();
  });

  it("applies the stamp pill styling", () => {
    const { container } = render(
      <BillingStatusBadge status="sent" label="Sent" />
    );
    const badge = container.querySelector("span");
    expect(badge!.className).toContain("stamp");
  });
});
