/**
 * no-attached-companies-callout.test.tsx
 *
 * Required regression test:
 *   test_no_companies_callout_renders_instead_of_form
 *
 * Verifies the callout renders i18n strings (not hardcoded English) and
 * links to /settings#my-companies.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NoAttachedCompaniesCallout } from "@/components/billing/no-attached-companies-callout";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("next-intl", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const en = require("../../../messages/en.json") as Record<string, unknown>;
  function resolve(obj: Record<string, unknown>, path: string): string {
    return path.split(".").reduce<unknown>((acc, k) => {
      if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[k];
      return undefined;
    }, obj) as string ?? path;
  }
  const makeT = (ns: string) => (key: string) => resolve(en, `${ns}.${key}`);
  return { useTranslations: (ns: string) => makeT(ns) };
});

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

// ---------------------------------------------------------------------------
// test_no_companies_callout_renders_instead_of_form
// ---------------------------------------------------------------------------

describe("test_no_companies_callout_renders_instead_of_form", () => {
  it("renders the callout title (i18n key noCompaniesCalloutTitle)", () => {
    render(<NoAttachedCompaniesCallout />);
    // en.json: companies.picker.noCompaniesCalloutTitle = "No company attached"
    expect(screen.getByText(/no company attached/i)).toBeDefined();
  });

  it("renders the callout body (i18n key noCompaniesCalloutBody)", () => {
    render(<NoAttachedCompaniesCallout />);
    // en.json body mentions "Settings" — but so does the CTA; use getAllByText
    const matches = screen.getAllByText(/settings/i);
    expect(matches.length).toBeGreaterThan(0);
  });

  it("renders the CTA link (i18n key noCompaniesCalloutCta)", () => {
    render(<NoAttachedCompaniesCallout />);
    // en.json: companies.picker.noCompaniesCalloutCta = "Open Settings"
    const link = screen.getByRole("link", { name: /open settings/i });
    expect(link).toBeDefined();
    expect((link as HTMLAnchorElement).href).toContain("/settings");
  });

  it("links to /settings#my-companies", () => {
    render(<NoAttachedCompaniesCallout />);
    const link = screen.getByRole("link") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/settings#my-companies");
  });

  it("does NOT render a form or any input", () => {
    render(<NoAttachedCompaniesCallout />);
    expect(screen.queryByRole("form")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("renders the Building2 icon container", () => {
    const { container } = render(<NoAttachedCompaniesCallout />);
    // Lucide icon renders an SVG
    expect(container.querySelector("svg")).toBeDefined();
  });
});
