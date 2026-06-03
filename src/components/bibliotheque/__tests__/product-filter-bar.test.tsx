/**
 * product-filter-bar.test.tsx — ProductFilterBar component tests.
 *
 * Tests:
 *   - All-categories option renders
 *   - Canonical slugs in categories prop render in canonical order
 *   - Option value stays the slug (not the localized label)
 *   - Localized labels are rendered (not raw slugs) for canonical slugs
 *   - Unknown/legacy slugs appended after canonical ones, rendered raw
 *   - onCategoryChange fires with the slug value on change
 *   - All-suppliers option renders
 *   - onSupplierChange fires with supplier id
 *   - onSearchChange fires on search input change
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductFilterBar } from "../product-filter-bar";
import type { Supplier } from "@/lib/api/bibliotheque";

vi.mock("next-intl", () => ({
  useTranslations:
    (_ns: string) =>
    (key: string) => {
      // Reflect the key back so tests can assert which key was used
      if (key.startsWith("categories.")) return `[${key.replace("categories.", "")}]`;
      const map: Record<string, string> = {
        allSuppliers: "All suppliers",
        allCategories: "All categories",
        category: "Category",
        supplier: "Supplier",
        searchPlaceholder: "Search products…",
        uncategorized: "Uncategorized",
      };
      return map[key] ?? key;
    },
}));

const SUPPLIERS: Supplier[] = [
  {
    id: "sup-1",
    company_id: "co-1",
    name: "ACME",
    slug: "acme",
    website_url: null,
    logo_url: null,
    product_url_template: null,
    created_at: "2024-01-01T00:00:00Z",
  },
];

describe("ProductFilterBar", () => {
  it("renders the all-categories default option", () => {
    render(
      <ProductFilterBar
        suppliers={[]}
        categories={[]}
        supplier=""
        category=""
        search=""
        onSupplierChange={vi.fn()}
        onCategoryChange={vi.fn()}
        onSearchChange={vi.fn()}
      />
    );
    expect(screen.getByRole("option", { name: "All categories" })).toBeInTheDocument();
  });

  it("renders canonical slugs in canonical order (not insertion order)", () => {
    // Pass slugs in reverse canonical order — expect output in canonical order
    const categories = ["outillage", "cuisine", "terrasse_jardin"];
    render(
      <ProductFilterBar
        suppliers={[]}
        categories={categories}
        supplier=""
        category=""
        search=""
        onSupplierChange={vi.fn()}
        onCategoryChange={vi.fn()}
        onSearchChange={vi.fn()}
      />
    );
    const select = screen.getByRole("combobox", { name: "Category" });
    const options = Array.from(select.querySelectorAll("option")).map((o) => o.value);
    // First option is the "all" option (value "")
    const categoryOptions = options.filter((v) => v !== "");
    // terrasse_jardin (index 0) < cuisine (index 5) < outillage (index 11) in canonical order
    expect(categoryOptions.indexOf("terrasse_jardin")).toBeLessThan(
      categoryOptions.indexOf("cuisine")
    );
    expect(categoryOptions.indexOf("cuisine")).toBeLessThan(
      categoryOptions.indexOf("outillage")
    );
  });

  it("renders localized labels for canonical slugs", () => {
    render(
      <ProductFilterBar
        suppliers={[]}
        categories={["cuisine", "outillage"]}
        supplier=""
        category=""
        search=""
        onSupplierChange={vi.fn()}
        onCategoryChange={vi.fn()}
        onSearchChange={vi.fn()}
      />
    );
    // fakeT returns "[slug]" for categories.slug
    expect(screen.getByRole("option", { name: "[cuisine]" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "[outillage]" })).toBeInTheDocument();
  });

  it("option value stays the slug, not the localized label", () => {
    render(
      <ProductFilterBar
        suppliers={[]}
        categories={["cuisine"]}
        supplier=""
        category=""
        search=""
        onSupplierChange={vi.fn()}
        onCategoryChange={vi.fn()}
        onSearchChange={vi.fn()}
      />
    );
    const opt = screen.getByRole("option", { name: "[cuisine]" }) as HTMLOptionElement;
    expect(opt.value).toBe("cuisine");
  });

  it("appends unknown/legacy slugs after canonical ones, rendered raw", () => {
    render(
      <ProductFilterBar
        suppliers={[]}
        categories={["cuisine", "LegacyOldCategory"]}
        supplier=""
        category=""
        search=""
        onSupplierChange={vi.fn()}
        onCategoryChange={vi.fn()}
        onSearchChange={vi.fn()}
      />
    );
    const select = screen.getByRole("combobox", { name: "Category" });
    const options = Array.from(select.querySelectorAll("option")).map((o) => o.value);
    const categoryOptions = options.filter((v) => v !== "");
    // canonical slug comes before legacy
    expect(categoryOptions.indexOf("cuisine")).toBeLessThan(
      categoryOptions.indexOf("LegacyOldCategory")
    );
    // legacy slug rendered with its raw value
    expect(screen.getByRole("option", { name: "LegacyOldCategory" })).toBeInTheDocument();
  });

  it("fires onCategoryChange with the slug value on selection", async () => {
    const onCategoryChange = vi.fn();
    render(
      <ProductFilterBar
        suppliers={[]}
        categories={["cuisine", "outillage"]}
        supplier=""
        category=""
        search=""
        onSupplierChange={vi.fn()}
        onCategoryChange={onCategoryChange}
        onSearchChange={vi.fn()}
      />
    );
    const select = screen.getByRole("combobox", { name: "Category" });
    await userEvent.selectOptions(select, "cuisine");
    expect(onCategoryChange).toHaveBeenCalledWith("cuisine");
  });

  it("renders all-suppliers option", () => {
    render(
      <ProductFilterBar
        suppliers={SUPPLIERS}
        categories={[]}
        supplier=""
        category=""
        search=""
        onSupplierChange={vi.fn()}
        onCategoryChange={vi.fn()}
        onSearchChange={vi.fn()}
      />
    );
    expect(screen.getByRole("option", { name: "All suppliers" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "ACME" })).toBeInTheDocument();
  });

  it("fires onSupplierChange with supplier id on selection", async () => {
    const onSupplierChange = vi.fn();
    render(
      <ProductFilterBar
        suppliers={SUPPLIERS}
        categories={[]}
        supplier=""
        category=""
        search=""
        onSupplierChange={onSupplierChange}
        onCategoryChange={vi.fn()}
        onSearchChange={vi.fn()}
      />
    );
    const select = screen.getByRole("combobox", { name: "Supplier" });
    await userEvent.selectOptions(select, "sup-1");
    expect(onSupplierChange).toHaveBeenCalledWith("sup-1");
  });

  it("fires onSearchChange on search input", async () => {
    const onSearchChange = vi.fn();
    render(
      <ProductFilterBar
        suppliers={[]}
        categories={[]}
        supplier=""
        category=""
        search=""
        onSupplierChange={vi.fn()}
        onCategoryChange={vi.fn()}
        onSearchChange={onSearchChange}
      />
    );
    const input = screen.getByPlaceholderText("Search products…");
    await userEvent.type(input, "hammer");
    expect(onSearchChange).toHaveBeenCalled();
    expect(onSearchChange.mock.calls.at(-1)?.[0]).toContain("r"); // last char
  });
});
