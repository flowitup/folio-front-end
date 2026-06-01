/**
 * product-compare-dialog.test.tsx — ProductCompareDialog tests.
 *
 * Tests:
 *   - Not rendered when open is false
 *   - Renders a column per product (names) when open
 *   - Cheapest non-null last unit price highlighted (stamp positive)
 *   - Null last unit price renders an em dash
 *   - onRemove fires with the product id on the column × button
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductCompareDialog } from "../product-compare-dialog";
import type { LibraryProduct, Supplier } from "@/lib/api/bibliotheque";

vi.mock("next-intl", () => ({
  useTranslations:
    (ns: string) =>
    (key: string, opts?: Record<string, unknown>) => {
      if (key === "purchasedTimes") return `Purchased ${opts?.count} times`;
      const map: Record<string, string> = {
        compareTitle: "Compare products",
        supplier: "Supplier",
        category: "Category",
        size: "Size",
        lastUnitPrice: "Last unit price",
        purchaseHistory: "Purchases",
        lastPurchased: "Last purchased",
        viewProduct: "View product",
        uncategorized: "Uncategorized",
        removeFromCompare: "Remove from comparison",
      };
      return map[key] ?? `${ns}.${key}`;
    },
  useLocale: () => "en",
}));

vi.mock("@/components/bibliotheque/product-image", () => ({
  ProductImage: ({ alt }: { alt: string }) => <div data-testid="product-image" data-alt={alt} />,
}));

function makeProduct(overrides?: Partial<LibraryProduct>): LibraryProduct {
  return {
    id: "prod-1",
    company_id: "co-1",
    supplier_id: "sup-1",
    supplier_reference: "REF-001",
    name: "Product One",
    description: null,
    size: "L",
    category: "Tools",
    has_image: true,
    product_url: "https://example.com/1",
    purchase_count: 2,
    total_quantity: "5",
    last_unit_price: "25.00",
    first_purchased_at: "2024-01-01T00:00:00Z",
    last_purchased_at: "2024-05-01T00:00:00Z",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

const suppliers: Record<string, Supplier> = {
  "sup-1": {
    id: "sup-1",
    company_id: "co-1",
    name: "ACME",
    slug: "acme",
    website_url: null,
    logo_url: null,
    product_url_template: null,
    created_at: "2024-01-01T00:00:00Z",
  },
};

describe("ProductCompareDialog", () => {
  it("does not render content when open is false", () => {
    render(
      <ProductCompareDialog
        open={false}
        products={[makeProduct()]}
        suppliersById={suppliers}
        onRemove={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.queryByText("Compare products")).not.toBeInTheDocument();
  });

  it("renders a column per product when open", () => {
    render(
      <ProductCompareDialog
        open
        products={[
          makeProduct({ id: "a", name: "Alpha" }),
          makeProduct({ id: "b", name: "Beta" }),
        ]}
        suppliersById={suppliers}
        onRemove={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText("Last unit price")).toBeInTheDocument();
  });

  it("highlights the cheapest non-null last unit price", () => {
    render(
      <ProductCompareDialog
        open
        products={[
          makeProduct({ id: "a", name: "Alpha", last_unit_price: "30.00" }),
          makeProduct({ id: "b", name: "Beta", last_unit_price: "12.50" }),
        ]}
        suppliersById={suppliers}
        onRemove={vi.fn()}
        onClose={vi.fn()}
      />
    );
    // The cheapest (12.50) is wrapped in a positive stamp; the dearer one is not.
    const cheapest = screen.getByText("€12.50");
    expect(cheapest.className).toContain("positive");
    const dearer = screen.getByText("€30.00");
    expect(dearer.className).not.toContain("positive");
  });

  it("renders an em dash for a null last unit price", () => {
    render(
      <ProductCompareDialog
        open
        products={[
          makeProduct({ id: "a", name: "Alpha", last_unit_price: "12.50" }),
          makeProduct({ id: "b", name: "Beta", last_unit_price: null }),
        ]}
        suppliersById={suppliers}
        onRemove={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("fires onRemove with the product id when the column × is clicked", async () => {
    const onRemove = vi.fn();
    render(
      <ProductCompareDialog
        open
        products={[
          makeProduct({ id: "a", name: "Alpha" }),
          makeProduct({ id: "b", name: "Beta" }),
        ]}
        suppliersById={suppliers}
        onRemove={onRemove}
        onClose={vi.fn()}
      />
    );
    const removeButtons = screen.getAllByRole("button", { name: "Remove from comparison" });
    await userEvent.click(removeButtons[0]);
    expect(onRemove).toHaveBeenCalledWith("a");
  });
});
