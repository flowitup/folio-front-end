/**
 * Tests for RefundSourceIndicator — company/bank/both/none icon badges.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RefundSourceIndicator } from "../refund-source-indicator";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => `invoices.${key}`,
}));

describe("RefundSourceIndicator", () => {
  it("renders nothing when neither source applies", () => {
    const { container } = render(
      <RefundSourceIndicator refundable_status="refundable" has_bank_refund={false} />
    );
    expect(container.querySelector('[data-testid="refund-source-indicator"]')).toBeNull();
  });

  it("company only: company icon, no bank icon", () => {
    render(<RefundSourceIndicator refundable_status="refunded" has_bank_refund={false} />);
    expect(screen.getByTestId("refund-source-company")).toBeDefined();
    expect(screen.queryByTestId("refund-source-bank")).toBeNull();
  });

  it("bank only: bank icon, no company icon", () => {
    render(<RefundSourceIndicator refundable_status="refund_pending" has_bank_refund={true} />);
    expect(screen.getByTestId("refund-source-bank")).toBeDefined();
    expect(screen.queryByTestId("refund-source-company")).toBeNull();
  });

  it("both: company and bank icons, combined tooltip", () => {
    render(<RefundSourceIndicator refundable_status="refunded" has_bank_refund={true} />);
    expect(screen.getByTestId("refund-source-company")).toBeDefined();
    expect(screen.getByTestId("refund-source-bank")).toBeDefined();
    const wrapper = screen.getByTestId("refund-source-indicator");
    expect(wrapper.getAttribute("title")).toBe("invoices.refundSource.both");
  });

  it("refunded_by='bank' → bank icon without has_bank_refund", () => {
    render(
      <RefundSourceIndicator
        refundable_status="refunded"
        has_bank_refund={false}
        refunded_by="bank"
      />
    );
    expect(screen.getByTestId("refund-source-bank")).toBeDefined();
    expect(screen.queryByTestId("refund-source-company")).toBeNull();
  });

  it("refunded_by=null (legacy) → company icon", () => {
    render(
      <RefundSourceIndicator
        refundable_status="refunded"
        has_bank_refund={false}
        refunded_by={null}
      />
    );
    expect(screen.getByTestId("refund-source-company")).toBeDefined();
    expect(screen.queryByTestId("refund-source-bank")).toBeNull();
  });
});
