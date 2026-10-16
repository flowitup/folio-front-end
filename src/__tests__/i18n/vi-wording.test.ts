/** Vietnamese: cost planning is "Dự toán" (an estimate, not "hạch toán" accounting) and the tax is VAT. */
import { describe, it, expect } from "vitest";
import vi from "@/messages/vi.json";
import { helpCatalogueVi, helpChromeVi } from "@/content/help/vi";

function strings(obj: unknown, out: string[] = []): string[] {
  if (typeof obj === "string") out.push(obj);
  else if (obj && typeof obj === "object") for (const v of Object.values(obj)) strings(v, out);
  return out;
}

describe("vi wording", () => {
  it("names cost planning 'Dự toán', never 'hạch toán' (accounting)", () => {
    expect(vi.navigation.chiffrage).toBe("Dự toán");
    expect(strings(vi).some((s) => /ạch toán/i.test(s))).toBe(false);
    // The help names the section as the sidebar does.
    expect(strings([helpCatalogueVi, helpChromeVi]).some((s) => /ạch toán/i.test(s))).toBe(false);
  });

  it("uses one tone-mark style (Hủy, Xóa, hóa, tùy), so neighbouring buttons match", () => {
    const all = strings([vi, helpCatalogueVi, helpChromeVi]);
    expect(all.filter((s) => /uỷ|oá(?![a-zà-ỹ])|uỳ/i.test(s))).toEqual([]);
  });

  it("names the company billing group apart from a project's quotes & invoices", () => {
    const same = (a: string, b: string) => a.toLocaleLowerCase("vi") === b.toLocaleLowerCase("vi");
    expect(same(vi.sidebar.billing.title, vi.navigation.quotesInvoices)).toBe(false);
    expect(same(vi.billing.group.title, vi.navigation.quotesInvoices)).toBe(false);
  });

  it("calls the tax VAT in expenses, quotes and cost planning (not the French TVA)", () => {
    const areas = [vi.invoices, vi.billing, vi.chiffrage];
    expect(areas.flatMap((a) => strings(a)).some((s) => /\bTVA\b/.test(s))).toBe(false);
  });
});
