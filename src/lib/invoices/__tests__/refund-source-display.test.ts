/**
 * Unit tests for the refund-source derivation helpers.
 * Company = refundable_status === 'refunded' (NOT 'refund_pending').
 * Bank    = has_bank_refund truthy.
 */

import { describe, it, expect } from "vitest";
import {
  getRefundSource,
  refundSourceI18nKey,
} from "@/lib/invoices/refundable-status-display";

describe("getRefundSource", () => {
  it("none: not refunded and no bank refund", () => {
    expect(getRefundSource({ refundable_status: "refundable", has_bank_refund: false })).toEqual({
      byCompany: false,
      byBank: false,
    });
  });

  it("company only: refunded, no bank", () => {
    expect(getRefundSource({ refundable_status: "refunded", has_bank_refund: false })).toEqual({
      byCompany: true,
      byBank: false,
    });
  });

  it("bank only: not refunded, has bank refund", () => {
    expect(getRefundSource({ refundable_status: "refund_pending", has_bank_refund: true })).toEqual({
      byCompany: false,
      byBank: true,
    });
  });

  it("both: refunded and has bank refund", () => {
    expect(getRefundSource({ refundable_status: "refunded", has_bank_refund: true })).toEqual({
      byCompany: true,
      byBank: true,
    });
  });

  it("refund_pending is NOT company-refunded", () => {
    expect(getRefundSource({ refundable_status: "refund_pending" }).byCompany).toBe(false);
  });

  it("null/undefined inputs → all false", () => {
    expect(getRefundSource({})).toEqual({ byCompany: false, byBank: false });
    expect(getRefundSource({ refundable_status: null, has_bank_refund: null })).toEqual({
      byCompany: false,
      byBank: false,
    });
  });
});

describe("refundSourceI18nKey", () => {
  it("maps each combination to its key, null when neither", () => {
    expect(refundSourceI18nKey({ byCompany: true, byBank: true })).toBe("refundSource.both");
    expect(refundSourceI18nKey({ byCompany: true, byBank: false })).toBe("refundSource.company");
    expect(refundSourceI18nKey({ byCompany: false, byBank: true })).toBe("refundSource.bank");
    expect(refundSourceI18nKey({ byCompany: false, byBank: false })).toBeNull();
  });
});
