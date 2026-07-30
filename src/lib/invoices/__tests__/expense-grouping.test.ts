import { describe, it, expect } from "vitest";
import type { Invoice } from "@/types/invoice";
import { groupByTimeline, groupByCategory } from "../expense-grouping";

function makeInvoice(overrides: Partial<Invoice>): Invoice {
  return {
    id: "inv-1",
    project_id: "proj-1",
    invoice_number: "INV-2026-0001",
    type: "materials_services",
    issue_date: "2026-06-01",
    recipient_name: "Supplier",
    recipient_address: null,
    notes: null,
    items: [],
    total_amount: 100,
    created_by: "user-1",
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    payment_method_id: null,
    payment_method_label: null,
    source_billing_document_id: null,
    is_auto_generated: false,
    service_month: null,
    ...overrides,
  };
}

describe("groupByTimeline", () => {
  it("nests months under year headers, both sorted descending", () => {
    const invoices = [
      makeInvoice({ id: "a", issue_date: "2025-01-15" }),
      makeInvoice({ id: "b", issue_date: "2026-03-10" }),
      makeInvoice({ id: "c", issue_date: "2026-01-05" }),
      makeInvoice({ id: "d", issue_date: "2025-11-20" }),
    ];

    const sections = groupByTimeline(invoices, "en");

    // Sections are a flat list; keys reveal the desc month order across years.
    expect(sections.map((s) => s.key)).toEqual(["2026-03", "2026-01", "2025-11", "2025-01"]);

    // Year header only flags the first section of each year.
    expect(sections[0].hasYearHeader).toBe(true);
    expect(sections[0].yearLabel).toBe("2026");
    expect(sections[1].hasYearHeader).toBe(false);
    expect(sections[2].hasYearHeader).toBe(true);
    expect(sections[2].yearLabel).toBe("2025");
    expect(sections[3].hasYearHeader).toBe(false);
  });

  it("computes year-level count and net across all months in that year", () => {
    const invoices = [
      makeInvoice({ id: "a", issue_date: "2026-03-10", total_amount: 100 }),
      makeInvoice({ id: "b", issue_date: "2026-01-05", total_amount: 250 }),
    ];

    const sections = groupByTimeline(invoices, "en");
    const marchSection = sections.find((s) => s.key === "2026-03")!;

    expect(marchSection.yearCount).toBe(2);
    expect(marchSection.yearNet).toBe(350);
  });

  it("computes net per month, including negative return rows", () => {
    const invoices = [
      makeInvoice({ id: "a", issue_date: "2026-06-10", type: "materials_services", total_amount: 500 }),
      makeInvoice({ id: "b", issue_date: "2026-06-20", type: "return", total_amount: -150 }),
    ];

    const sections = groupByTimeline(invoices, "en");
    const june = sections.find((s) => s.key === "2026-06")!;

    expect(june.count).toBe(2);
    expect(june.net).toBe(350);
    // Rows within a month stay date-desc.
    expect(june.rows.map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("localizes month names via Intl.DateTimeFormat(locale)", () => {
    const invoices = [makeInvoice({ issue_date: "2026-06-01" })];

    const en = groupByTimeline(invoices, "en");
    const fr = groupByTimeline(invoices, "fr");

    expect(en[0].headerLabel).toBe("June");
    expect(fr[0].headerLabel).toBe("juin");
  });

  it("returns an empty array for an empty list", () => {
    expect(groupByTimeline([], "en")).toEqual([]);
  });
});

describe("groupByCategory", () => {
  const t = (key: string) => `invoices.${key}`;

  it("orders groups released_funds, labor, materials_services, others, return", () => {
    const invoices = [
      makeInvoice({ id: "a", type: "return", total_amount: -50 }),
      makeInvoice({ id: "b", type: "others" }),
      makeInvoice({ id: "c", type: "released_funds" }),
      makeInvoice({ id: "d", type: "labor" }),
      makeInvoice({ id: "e", type: "materials_services" }),
    ];

    const sections = groupByCategory(invoices, t);

    expect(sections.map((s) => s.key)).toEqual([
      "released_funds",
      "labor",
      "materials_services",
      "others",
      "return",
    ]);
    expect(sections.every((s) => s.hasYearHeader === false)).toBe(true);
  });

  it("omits types with zero matching rows entirely", () => {
    const invoices = [makeInvoice({ type: "labor" })];

    const sections = groupByCategory(invoices, t);

    expect(sections).toHaveLength(1);
    expect(sections[0].key).toBe("labor");
  });

  it("computes net per group, including negative return rows", () => {
    const invoices = [
      makeInvoice({ id: "a", type: "return", total_amount: -200 }),
      makeInvoice({ id: "b", type: "return", total_amount: -100 }),
    ];

    const sections = groupByCategory(invoices, t);

    expect(sections[0].net).toBe(-300);
    expect(sections[0].count).toBe(2);
  });

  it("localizes the header label via the injected translator", () => {
    const invoices = [makeInvoice({ type: "materials_services" })];

    const sections = groupByCategory(invoices, t);

    expect(sections[0].headerLabel).toBe("invoices.types.materials_services");
    expect(sections[0].type).toBe("materials_services");
  });

  it("returns an empty array when no invoices match any category", () => {
    expect(groupByCategory([], t)).toEqual([]);
  });
});
