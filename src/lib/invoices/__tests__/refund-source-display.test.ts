/**
 * Unit tests for the refund-source derivation helpers.
 * Company = refundable_status === 'refunded' (NOT 'refund_pending').
 * Bank    = has_bank_refund truthy.
 */

import { describe, it, expect } from "vitest";
import {
  getRefundSource,
  refundSourceI18nKey,
  refundStatusI18nKey,
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

  it("refunded_by='bank' → bank icon without has_bank_refund", () => {
    expect(
      getRefundSource({ refundable_status: "refunded", has_bank_refund: false, refunded_by: "bank" })
    ).toEqual({ byCompany: false, byBank: true });
  });

  it("refunded_by='both' → company AND bank icons", () => {
    expect(
      getRefundSource({ refundable_status: "refunded", has_bank_refund: false, refunded_by: "both" })
    ).toEqual({ byCompany: true, byBank: true });
  });

  it("refunded_by='company' → company only", () => {
    expect(
      getRefundSource({ refundable_status: "refunded", has_bank_refund: false, refunded_by: "company" })
    ).toEqual({ byCompany: true, byBank: false });
  });

  it("refunded_by=null (legacy) → company (backward compatible)", () => {
    expect(
      getRefundSource({ refundable_status: "refunded", has_bank_refund: false, refunded_by: null })
    ).toEqual({ byCompany: true, byBank: false });
  });

  it("refunded_by='bank' plus has_bank_refund still just byBank (no double-count)", () => {
    expect(
      getRefundSource({ refundable_status: "refunded", has_bank_refund: true, refunded_by: "bank" })
    ).toEqual({ byCompany: false, byBank: true });
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

describe("refundStatusI18nKey", () => {
  it("returns null when there is no refundable status", () => {
    expect(refundStatusI18nKey({ refundable_status: null })).toBeNull();
    expect(refundStatusI18nKey({})).toBeNull();
  });

  it("passes non-refunded statuses straight through", () => {
    expect(refundStatusI18nKey({ refundable_status: "refundable" })).toBe("refund.status.refundable");
    expect(refundStatusI18nKey({ refundable_status: "refund_pending" })).toBe(
      "refund.status.refundPending"
    );
  });

  it("bank-refunded does NOT claim the company refunded it", () => {
    expect(
      refundStatusI18nKey({ refundable_status: "refunded", refunded_by: "bank" })
    ).toBe("refundSource.bank");
  });

  it("both-refunded names both sides", () => {
    expect(
      refundStatusI18nKey({ refundable_status: "refunded", refunded_by: "both" })
    ).toBe("refundSource.both");
  });

  it("company-refunded names the company", () => {
    expect(
      refundStatusI18nKey({ refundable_status: "refunded", refunded_by: "company" })
    ).toBe("refundSource.company");
  });

  it("legacy refunded row (refunded_by null, no linked refund) still reads as company", () => {
    expect(
      refundStatusI18nKey({ refundable_status: "refunded", refunded_by: null })
    ).toBe("refundSource.company");
  });

  it("a linked refund invoice on a refunded row surfaces both sides", () => {
    expect(
      refundStatusI18nKey({ refundable_status: "refunded", has_bank_refund: true })
    ).toBe("refundSource.both");
  });
});
