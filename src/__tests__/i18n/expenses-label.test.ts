/** English names the expenses ledger in the plural, as the rest of the UI and the mobile app do. */
import { describe, it, expect } from "vitest";
import en from "@/messages/en.json";
import { helpCatalogueEn } from "@/content/help/en";

describe("en expenses label", () => {
  it("says 'Expenses' in the nav, the top bar, the page title and the dashboard link", () => {
    expect(en.navigation.invoices).toBe("Expenses");
    expect(en.topbar.invoicesTitle).toBe("Expenses");
    expect(en.invoices.title).toBe("Expenses");
    expect(en.dashboard.spendByType.viewExpense).toBe("Expenses");
  });

  it("names the section 'Expenses' in the help too", () => {
    expect(JSON.stringify(helpCatalogueEn)).not.toMatch(/Labor, Expense,|“Expense”/);
  });
});
