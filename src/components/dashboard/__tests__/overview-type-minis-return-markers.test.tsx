/**
 * Return markers on the "Monthly spend by type" small multiples.
 *
 * The overview shows spend NET of returns, which means a month can dip — or go
 * negative — for a credit rather than for a change in purchasing. The marker is
 * what stops that dip from being mysterious: it appears only on months a credit
 * landed in, and its hover reveals the credited amount.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { OverviewTypeMinis } from "../overview-type-minis";
import type { TypeMonthlyBucket } from "@/lib/dashboard/overview-metrics";

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) =>
    (key: string, params?: Record<string, unknown>) => {
      const full = namespace ? `${namespace}.${key}` : key;
      return params ? `${full}(${JSON.stringify(params)})` : full;
    },
  useLocale: () => "en",
}));

vi.mock("next/link", () => ({
  default: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

function point(
  key: string,
  total: number,
  count: number,
  credited = 0,
  creditCount = 0
) {
  return { key, total, count, credited, creditCount };
}

/** Materials & services: a 1 000 € purchase in May, a 250 € credit in June. */
function buckets(): TypeMonthlyBucket[] {
  return [
    {
      type: "materials_services",
      monthly: [point("2026-05", 1000, 1), point("2026-06", -250, 0, -250, 1)],
      total: 750,
      count: 1,
      deltaPct: null,
    },
    {
      type: "labor",
      monthly: [point("2026-05", 400, 1), point("2026-06", 0, 0)],
      total: 400,
      count: 1,
      deltaPct: null,
    },
    {
      type: "others",
      monthly: [point("2026-05", 0, 0), point("2026-06", 0, 0)],
      total: 0,
      count: 0,
      deltaPct: null,
    },
  ];
}

describe("OverviewTypeMinis — return markers", () => {
  it("marks only the months a credit landed in", () => {
    render(<OverviewTypeMinis buckets={buckets()} viewExpenseHref={null} />);
    expect(screen.getByTestId("return-marker-materials_services-2026-06")).toBeTruthy();
    // No credit → no marker, on the same type or any other.
    expect(screen.queryByTestId("return-marker-materials_services-2026-05")).toBeNull();
    expect(screen.queryByTestId("return-marker-labor-2026-06")).toBeNull();
  });

  it("hovering the marker reveals the credited amount and its count", () => {
    render(<OverviewTypeMinis buckets={buckets()} viewExpenseHref={null} />);
    const marker = screen.getByTestId("return-marker-materials_services-2026-06");
    const tip = marker.querySelector("[data-tip]")!.getAttribute("data-tip")!;
    const [, value, meta] = tip.split("|");
    // The credit, not the month's net total.
    expect(value.replace(/[^0-9-]/g, "")).toBe("-250");
    expect(meta).toContain("returnsReceived");
    expect(meta).toContain('"n":1');
  });

  it("paints the marker hit area after the column hit areas so it wins the hover", () => {
    const { container } = render(
      <OverviewTypeMinis buckets={buckets()} viewExpenseHref={null} />
    );
    const svg = container.querySelector("svg")!;
    const tipped = Array.from(svg.querySelectorAll("[data-tip]"));
    const marker = svg.querySelector(
      '[data-testid="return-marker-materials_services-2026-06"] [data-tip]'
    )!;
    // SVG has no z-index — paint order decides. The marker must come last.
    expect(tipped.indexOf(marker)).toBe(tipped.length - 1);
  });

  it("labels the widget as net of returns", () => {
    render(<OverviewTypeMinis buckets={buckets()} viewExpenseHref={null} />);
    expect(screen.getByText(/invoices\.summary\.netOfReturns/)).toBeTruthy();
  });

  it("renders no markers at all when nothing was returned", () => {
    const clean = buckets().map((b) => ({
      ...b,
      monthly: b.monthly.map((p) => ({ ...p, credited: 0, creditCount: 0 })),
    }));
    const { container } = render(
      <OverviewTypeMinis buckets={clean} viewExpenseHref={null} />
    );
    expect(container.querySelectorAll('[data-testid^="return-marker-"]')).toHaveLength(0);
  });
});
