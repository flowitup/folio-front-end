/** Vietnamese: one spelling of "hạch toán" and one name for the tax (VAT). */
import { describe, it, expect } from "vitest";
import vi from "@/messages/vi.json";
import { helpCatalogueVi, helpChromeVi } from "@/content/help/vi";

function strings(obj: unknown, out: string[] = []): string[] {
  if (typeof obj === "string") out.push(obj);
  else if (obj && typeof obj === "object") for (const v of Object.values(obj)) strings(v, out);
  return out;
}

describe("vi wording", () => {
  it("spells 'Hạch toán' correctly", () => {
    expect(vi.navigation.chiffrage).toBe("Hạch toán");
    expect(strings(vi).some((s) => /oạch toán/i.test(s))).toBe(false);
    // The help names the section as the sidebar does.
    expect(strings([helpCatalogueVi, helpChromeVi]).some((s) => /oạch toán/i.test(s))).toBe(false);
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
