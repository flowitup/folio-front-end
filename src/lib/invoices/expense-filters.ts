/**
 * URL filters of the Expense list (`/projects/<id>/invoices`), so every chart
 * and summary figure can open the expenses it adds up:
 *
 * - `type`  — a ledger tab (labor, materials_services, others, return, released_funds);
 * - `month` — "YYYY-MM", the month the ledger files the expense under (labor by
 *   its service month);
 * - `purse` — company | personal | none, by the same rules as the purse cards
 *   (see `isCompanyPaidExpense` / `isPersonalExpense`).
 *
 * `expenseListHref` writes them, `readExpenseListFilters` reads them back and
 * `matchesExpenseFilters` applies month and purse to a row (type is the tab).
 */
import type { Invoice, InvoiceType } from "@/types/invoice";
import { isCompanyPaidExpense, isPersonalExpense } from "@/lib/dashboard/overview-metrics";
import { monthKeyForInvoice } from "@/lib/invoices/group-invoices-by-month";

export type PurseFilter = "company" | "personal" | "none";

export interface ExpenseListFilters {
  type?: InvoiceType | null;
  month?: string | null;
  purse?: PurseFilter | null;
}

const TYPES: ReadonlySet<string> = new Set([
  "released_funds",
  "labor",
  "materials_services",
  "others",
  "return",
]);
const PURSES: ReadonlySet<string> = new Set(["company", "personal", "none"]);
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** `base` (the list's path) with the given filters as its query. */
export function expenseListHref(base: string, filters: ExpenseListFilters): string {
  const params = new URLSearchParams();
  if (filters.type) params.set("type", filters.type);
  if (filters.month) params.set("month", filters.month);
  if (filters.purse) params.set("purse", filters.purse);
  const qs = params.toString();
  return qs ? `${base}${base.includes("?") ? "&" : "?"}${qs}` : base;
}

/** The valid filters in a query; anything unknown is ignored. */
export function readExpenseListFilters(params: { get(name: string): string | null }): {
  type: InvoiceType | null;
  month: string | null;
  purse: PurseFilter | null;
} {
  const type = params.get("type");
  const month = params.get("month");
  const purse = params.get("purse");
  return {
    type: type && TYPES.has(type) ? (type as InvoiceType) : null,
    month: month && MONTH_RE.test(month) ? month : null,
    purse: purse && PURSES.has(purse) ? (purse as PurseFilter) : null,
  };
}

/**
 * The purse an expense counts in; null for a funds release (not spend). A cash
 * advance is company money handed to a person: the company purse counts it.
 */
export function invoicePurse(inv: Invoice): PurseFilter | null {
  if (inv.type === "released_funds") return inv.is_cash_advance ? "company" : null;
  if (isPersonalExpense(inv)) return "personal";
  if (isCompanyPaidExpense(inv)) return "company";
  return "none";
}

/** Whether a row belongs to the month and purse asked for (each optional). */
export function matchesExpenseFilters(
  inv: Invoice,
  { month, purse }: Pick<ExpenseListFilters, "month" | "purse">
): boolean {
  if (month && monthKeyForInvoice(inv) !== month) return false;
  if (purse && invoicePurse(inv) !== purse) return false;
  return true;
}
