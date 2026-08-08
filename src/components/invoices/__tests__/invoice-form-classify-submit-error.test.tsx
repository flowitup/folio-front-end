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
 * - unknown error codes fall back to the raw message, then a generic default
 */

import { describe, it, expect } from "vitest";
import { classifySubmitError } from "../invoice-form";

describe("classifySubmitError", () => {
  it("classifies RefundExceedsSource via formatCapError", () => {
    const err = {
      data: { error: "RefundExceedsSource", message: "Remaining: 42.50" },
    };
    const result = classifySubmitError(
      err,
      (remaining) => `capped at ${remaining}`,
      "service month not allowed"
    );
    expect(result).toBe("capped at 42.50");
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

  it("falls back to the raw error message for unknown codes", () => {
    const err = { data: { error: "SomeOtherError", message: "unexpected failure" } };
    const result = classifySubmitError(err, (remaining) => `capped at ${remaining}`);
    expect(result).toBe("unexpected failure");
  });

  it("falls back to a generic message for non-object errors", () => {
    const result = classifySubmitError("boom", (remaining) => `capped at ${remaining}`);
    expect(result).toBe("Failed to save invoice");
  });

  it("uses Error.message when err is a plain Error", () => {
    const result = classifySubmitError(
      new Error("network down"),
      (remaining) => `capped at ${remaining}`
    );
    expect(result).toBe("network down");
  });
});
