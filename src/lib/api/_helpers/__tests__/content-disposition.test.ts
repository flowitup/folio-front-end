/**
 * Unit tests for parseFilenameFromContentDisposition helper.
 */

import { describe, it, expect } from "vitest";
import { parseFilenameFromContentDisposition } from "../content-disposition";

describe("parseFilenameFromContentDisposition", () => {
  it("returns fallback when header is null", () => {
    expect(parseFilenameFromContentDisposition(null, "default.pdf")).toBe("default.pdf");
  });

  it("returns fallback when header is empty string", () => {
    expect(parseFilenameFromContentDisposition("", "default.pdf")).toBe("default.pdf");
  });

  it("decodes RFC 6266 filename*=UTF-8'' percent-encoded form", () => {
    const encoded = encodeURIComponent("invoices-société-2026-01.pdf");
    const header = `attachment; filename*=UTF-8''${encoded}`;
    expect(parseFilenameFromContentDisposition(header, "fallback.pdf")).toBe(
      "invoices-société-2026-01.pdf"
    );
  });

  it("parses plain filename=\"...\" form", () => {
    const header = 'attachment; filename="report.pdf"';
    expect(parseFilenameFromContentDisposition(header, "fallback.pdf")).toBe("report.pdf");
  });

  it("returns fallback when percent-decoding fails (malformed encoding)", () => {
    // %zz is not valid percent-encoding — decodeURIComponent will throw
    const header = "attachment; filename*=UTF-8''%zz-bad.pdf";
    expect(parseFilenameFromContentDisposition(header, "fallback.pdf")).toBe("fallback.pdf");
  });

  it("prefers filename* over plain filename when both are present (RFC 6266)", () => {
    const encoded = encodeURIComponent("preferred-utf8.pdf");
    const header = `attachment; filename*=UTF-8''${encoded}; filename="fallback-plain.pdf"`;
    expect(parseFilenameFromContentDisposition(header, "default.pdf")).toBe("preferred-utf8.pdf");
  });

  it("falls back to plain filename when filename* is absent", () => {
    const header = 'attachment; filename="plain-report.xlsx"';
    expect(parseFilenameFromContentDisposition(header, "default.xlsx")).toBe("plain-report.xlsx");
  });

  it("returns fallback when neither form is present in the header", () => {
    const header = "attachment";
    expect(parseFilenameFromContentDisposition(header, "default.pdf")).toBe("default.pdf");
  });
});
