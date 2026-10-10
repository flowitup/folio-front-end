/**
 * Tests for classifySubmitError — backend error code classification
 *
 * Covers:
 * - RefundExceedsSource still classified via formatCapError (regression guard)
 * - service_month_not_allowed classified via the dedicated message
 * - service_month_not_allowed falls through to the raw message when no
 *   dedicated message is supplied (caller opted out)
 * - AppliedExceedsTarget classified via the dedicated message (both the
 *   route's discriminator code and the exception class name)
 * - AppliedExceedsTarget falls through to the raw message when no
 *   dedicated message is supplied (caller opted out)
 * - worker_link_not_allowed / worker_not_in_project classified via their
 *   dedicated messages, with the same raw-message fallback
 * - unknown error codes fall back to the raw message, then a generic default
 */

import { describe, it, expect } from "vitest";
import { classifyActionError, classifySubmitError, invoiceValidationMessages } from "../invoice-form";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

describe("classifySubmitError", () => {
  it("classifies RefundExceedsSource via formatCapError, with the amount as euros", () => {
    const err = {
      data: { error: "RefundExceedsSource", message: "Remaining: 1243.10" },
    };
    const result = classifySubmitError(
      err,
      (remaining) => `capped at ${remaining}`,
      "service month not allowed"
    );
    expect(result).toMatch(/^capped at 1\s243,10\s€$/);
  });

  it("classifies service_month_not_allowed via the dedicated message", () => {
    const err = {
      data: { error: "service_month_not_allowed" },
    };
    const result = classifySubmitError(
      err,
      (remaining) => `capped at ${remaining}`,
      "Payment for month can only be set on labor expenses."
    );
    expect(result).toBe("Payment for month can only be set on labor expenses.");
  });

  it("falls back to the raw backend message when no dedicated message is supplied", () => {
    const err = {
      data: { error: "service_month_not_allowed", message: "raw backend message" },
    };
    const result = classifySubmitError(err, (remaining) => `capped at ${remaining}`);
    expect(result).toBe("raw backend message");
  });

  it("classifies AppliedExceedsTarget via the dedicated message", () => {
    const err = {
      data: {
        error: "AppliedExceedsTarget",
        message: "Applied amount exceeds target invoice total. Remaining applicable: 50",
      },
    };
    const result = classifySubmitError(
      err,
      (remaining) => `capped at ${remaining}`,
      "service month not allowed",
      "The avoir amount exceeds the target invoice's total."
    );
    expect(result).toBe("The avoir amount exceeds the target invoice's total.");
  });

  it("classifies the AppliedAmountExceedsTargetError class-name fallback", () => {
    const err = {
      data: { error: "AppliedAmountExceedsTargetError", message: "raw" },
    };
    const result = classifySubmitError(
      err,
      (remaining) => `capped at ${remaining}`,
      undefined,
      "The avoir amount exceeds the target invoice's total."
    );
    expect(result).toBe("The avoir amount exceeds the target invoice's total.");
  });

  it("falls back to the raw backend message for AppliedExceedsTarget when no dedicated message is supplied", () => {
    const err = {
      data: { error: "AppliedExceedsTarget", message: "raw backend message" },
    };
    const result = classifySubmitError(err, (remaining) => `capped at ${remaining}`);
    expect(result).toBe("raw backend message");
  });

  it("classifies worker_link_not_allowed via the dedicated message", () => {
    const err = {
      data: { error: "worker_link_not_allowed" },
    };
    const result = classifySubmitError(
      err,
      (remaining) => `capped at ${remaining}`,
      "service month not allowed",
      undefined,
      "A worker can only be linked on labor expenses."
    );
    expect(result).toBe("A worker can only be linked on labor expenses.");
  });

  it("classifies worker_not_in_project via the dedicated message", () => {
    const err = {
      data: { error: "worker_not_in_project" },
    };
    const result = classifySubmitError(
      err,
      (remaining) => `capped at ${remaining}`,
      "service month not allowed",
      undefined,
      "A worker can only be linked on labor expenses.",
      "The selected worker is not part of this project."
    );
    expect(result).toBe("The selected worker is not part of this project.");
  });

  it("falls back to the raw backend message when worker error codes have no dedicated message", () => {
    const err = {
      data: { error: "worker_not_in_project", message: "raw backend message" },
    };
    const result = classifySubmitError(err, (remaining) => `capped at ${remaining}`);
    expect(result).toBe("raw backend message");
  });

  it("falls back to the raw error message for unknown codes", () => {
    const err = { data: { error: "SomeOtherError", message: "unexpected failure" } };
    const result = classifySubmitError(err, (remaining) => `capped at ${remaining}`);
    expect(result).toBe("unexpected failure");
  });

  it("falls back to a generic message for non-object errors", () => {
    const result = classifySubmitError("boom", (remaining) => `capped at ${remaining}`);
    expect(result).toBe("Failed to save invoice");
  });

  it("translates the refund-tracked company-payment and applied-avoirs refusals", () => {
    const frT = (key: keyof typeof fr.invoices) => fr.invoices[key] as string;
    const classify = (message: string) =>
      classifySubmitError(
        { data: { error: "ValidationError", message } },
        (remaining) => `capped at ${remaining}`,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        invoiceValidationMessages(frT)
      );

    expect(classify("Expense already paid by the company — refund tracking does not apply")).toBe(
      fr.invoices.errorCompanyPaidRefundTracked
    );
    expect(classify("Unlink the avoirs applied to this invoice before changing its type")).toBe(
      fr.invoices.errorUnlinkAvoirsFirst
    );
    // Any other validation text still comes through as sent.
    expect(classify("Recipient name is required")).toBe("Recipient name is required");
    expect(en.invoices.errorCompanyPaidRefundTracked).toMatch(/company payment method/);
  });

  it("translates the refunded lock, the positive-return and the linked-returns refusals", () => {
    const frT = (key: keyof typeof fr.invoices) => fr.invoices[key] as string;
    const classify = (message: string) =>
      classifySubmitError(
        { data: { error: "ValidationError", message } },
        (remaining) => `capped at ${remaining}`,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        invoiceValidationMessages(frT)
      );

    expect(classify("Refunded expenses are locked; clear the refund status first")).toBe(
      fr.invoices.errorRefundedLocked
    );
    expect(classify("A return's total must be zero or negative")).toBe(fr.invoices.errorReturnTotalPositive);
    expect(classify("Unlink or delete this invoice's returns first")).toBe(fr.invoices.errorUnlinkReturnsFirst);
    expect(classify("Unlink this invoice's returns before changing its type")).toBe(
      fr.invoices.errorUnlinkReturnsFirst
    );
  });

  it("uses Error.message when err is a plain Error", () => {
    const result = classifySubmitError(
      new Error("network down"),
      (remaining) => `capped at ${remaining}`
    );
    expect(result).toBe("network down");
  });
});

describe("classifyActionError", () => {
  const frT = (key: keyof typeof fr.invoices) => fr.invoices[key] as string;

  it("translates a known refusal and never shows any other API text", () => {
    const refusal = (message: string, error = "ValidationError") => ({ data: { error, message } });
    const classify = (err: unknown) =>
      classifyActionError(err, invoiceValidationMessages(frT), fr.invoices.deleteInvoiceFailed);

    expect(classify(refusal("Unlink or delete this invoice's returns first"))).toBe(
      fr.invoices.errorUnlinkReturnsFirst
    );
    expect(classify(refusal("Refunded expenses are locked; clear the refund status first"))).toBe(
      fr.invoices.errorRefundedLocked
    );
    expect(classify(refusal("Invoice x not found", "NotFound"))).toBe(fr.invoices.deleteInvoiceFailed);
    expect(classify(new Error("network down"))).toBe(fr.invoices.deleteInvoiceFailed);
  });
});
