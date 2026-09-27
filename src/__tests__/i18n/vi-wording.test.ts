/** Vietnamese: one spelling of "hạch toán" and one name for the tax (VAT). */
import { describe, it, expect } from "vitest";
import vi from "@/messages/vi.json";

function strings(obj: unknown, out: string[] = []): string[] {
  if (typeof obj === "string") out.push(obj);
  else if (obj && typeof obj === "object") for (const v of Object.values(obj)) strings(v, out);
  return out;
}

describe("vi wording", () => {
  it("spells 'Hạch toán' correctly", () => {
    expect(vi.navigation.chiffrage).toBe("Hạch toán");
    expect(strings(vi).some((s) => s.includes("Hoạch toán"))).toBe(false);
  });

  it("calls the tax VAT in expenses, quotes and cost planning (not the French TVA)", () => {
    const areas = [vi.invoices, vi.billing, vi.chiffrage];
    expect(areas.flatMap((a) => strings(a)).some((s) => /\bTVA\b/.test(s))).toBe(false);
  });
});
