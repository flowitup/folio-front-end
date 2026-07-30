import type { Invoice, InvoiceType } from "@/types/invoice";

/**
 * Fixed display order for the "By category" view. Only non-empty groups are
 * emitted (see groupByCategory) — a project with no `others` expenses simply
 * has no `others` section.
 */
const CATEGORY_ORDER: readonly InvoiceType[] = [
  "released_funds",
  "labor",
  "materials_services",
  "others",
  "return",
];

/**
 * One renderable section of the grouped expense list — either a month
 * (timeline view) or a type (category view). `hasYearHeader` + the `year*`
 * fields are only set on the first section of a new year in timeline mode,
 * so the caller can render the year divider once per year while iterating a
 * single flat list of sections.
 */
export interface ExpenseGroupSection {
  /** Stable React key — "YYYY-MM" for timeline sections, the invoice type for category sections. */
  key: string;
  hasYearHeader: boolean;
  yearLabel?: string;
  /** Entry count across the whole year (all months) — only set when hasYearHeader. */
  yearCount?: number;
  /** Net total across the whole year — only set when hasYearHeader. */
  yearNet?: number;
  /** Month name (timeline) or localized type label (category). */
  headerLabel: string;
  /** Invoice type — only set in category mode, drives the header's tinted count stamp. */
  type?: InvoiceType;
  count: number;
  /** Σ total_amount for the section — negative `return` rows net correctly. */
  net: number;
  rows: Invoice[];
}

function sumTotal(rows: Invoice[]): number {
  return rows.reduce((sum, invoice) => sum + invoice.total_amount, 0);
}

/** Date-desc comparator over `issue_date` (YYYY-MM-DD, sorts correctly as a string). */
function byIssueDateDesc(a: Invoice, b: Invoice): number {
  if (a.issue_date === b.issue_date) return 0;
  return a.issue_date > b.issue_date ? -1 : 1;
}

/**
 * Groups invoices by month (desc), nesting months under year headers, for the
 * "Timeline" view. Rows are sorted date-desc overall and within each month.
 * Month names are localized via Intl.DateTimeFormat; parsed as UTC noon to
 * avoid the timezone day-shift that plain `new Date("YYYY-MM")` parsing can
 * cause (same approach as `formatMonthYear`).
 */
export function groupByTimeline(list: Invoice[], locale: string): ExpenseGroupSection[] {
  const sorted = [...list].sort(byIssueDateDesc);

  const byMonth = new Map<string, Invoice[]>();
  for (const invoice of sorted) {
    const monthKey = invoice.issue_date.slice(0, 7);
    const bucket = byMonth.get(monthKey);
    if (bucket) bucket.push(invoice);
    else byMonth.set(monthKey, [invoice]);
  }

  const byYear = new Map<string, string[]>();
  for (const monthKey of [...byMonth.keys()].sort().reverse()) {
    const year = monthKey.slice(0, 4);
    const bucket = byYear.get(year);
    if (bucket) bucket.push(monthKey);
    else byYear.set(year, [monthKey]);
  }

  const monthFormatter = new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" });
  const sections: ExpenseGroupSection[] = [];

  for (const year of [...byYear.keys()].sort().reverse()) {
    const monthKeys = byYear.get(year)!;
    const yearRows = monthKeys.flatMap((monthKey) => byMonth.get(monthKey)!);
    const yearCount = yearRows.length;
    const yearNet = sumTotal(yearRows);

    monthKeys.forEach((monthKey, index) => {
      const rows = byMonth.get(monthKey)!;
      const month = Number(monthKey.slice(5, 7));
      const headerLabel = monthFormatter.format(new Date(Date.UTC(Number(year), month - 1, 1, 12)));
      sections.push({
        key: monthKey,
        hasYearHeader: index === 0,
        yearLabel: index === 0 ? year : undefined,
        yearCount: index === 0 ? yearCount : undefined,
        yearNet: index === 0 ? yearNet : undefined,
        headerLabel,
        count: rows.length,
        net: sumTotal(rows),
        rows,
      });
    });
  }

  return sections;
}

/**
 * Groups invoices by type in a fixed display order for the "By category"
 * view. Empty groups are omitted entirely (a type with zero matching rows
 * gets no section, not an empty one). `t` is the "invoices"-scoped
 * translator, used to localize the type label shown in the group header.
 */
export function groupByCategory(
  list: Invoice[],
  t: (key: string) => string
): ExpenseGroupSection[] {
  const sorted = [...list].sort(byIssueDateDesc);

  return CATEGORY_ORDER.map((type) => ({
    type,
    rows: sorted.filter((invoice) => invoice.type === type),
  }))
    .filter((group) => group.rows.length > 0)
    .map(({ type, rows }) => ({
      key: type,
      hasYearHeader: false,
      headerLabel: t(`types.${type}`),
      type,
      count: rows.length,
      net: sumTotal(rows),
      rows,
    }));
}
