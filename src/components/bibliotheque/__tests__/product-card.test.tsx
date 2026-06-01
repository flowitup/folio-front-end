/**
 * product-card.test.tsx — ProductCard component tests.
 *
 * Tests:
 *   - Renders name, description, badges (supplier, category, size)
 *   - Renders "uncategorized" key when category is null
 *   - Renders purchase stats with ICU plural (purchasedTimes)
 *   - Renders icon-only "View product" link (accessible name) with href + target when product_url set
 *   - Link absent when product_url null
 *   - onClick callback fires on click
 *   - Keyboard support: Enter key triggers onClick
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductCard } from "../product-card";
import type { LibraryProduct, Supplier } from "@/lib/api/bibliotheque";

// ---- Mocks ----

vi.mock("next-intl", () => ({
  useTranslations: (_ns: string) => (key: string, opts?: Record<string, unknown>) => {
    if (key === "purchasedTimes") {
      const count = opts?.count as number;
      if (count === 0) return "Purchased 0 times";
      if (count === 1) return "Purchased 1 time";
      return `Purchased ${count} times`;
    }
    if (key === "uncategorized") return "Uncategorized";
    if (key === "viewProduct") return "View product";
    return `bibliotheque.${key}`;
  },
  useLocale: () => "en",
}));

vi.mock("@/components/bibliotheque/product-image", () => ({
  ProductImage: ({ alt, className }: { alt: string; className?: string }) => (
    <div data-testid="product-image" className={className} data-alt={alt}>
      Image placeholder
    </div>
  ),
}));

// ---- Helpers ----

function makeProduct(overrides?: Partial<LibraryProduct>): LibraryProduct {
  return {
    id: "prod-1",
    company_id: "co-1",
    supplier_id: "sup-1",
    supplier_reference: "REF-001",
    name: "Test Product",
    description: "A test product description",
    size: "Large",
    category: "Electronics",
    has_image: true,
    product_url: "https://example.com/product",
    purchase_count: 3,
    total_quantity: "10",
    last_unit_price: "25.50",
    first_purchased_at: "2024-01-01T00:00:00Z",
    last_purchased_at: "2024-05-15T00:00:00Z",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeSupplier(overrides?: Partial<Supplier>): Supplier {
  return {
    id: "sup-1",
    company_id: "co-1",
    name: "ACME Corp",
    slug: "acme",
    website_url: "https://acme.com",
    logo_url: null,
    product_url_template: "https://acme.com/products/{ref}",
    created_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

// ---- Tests ----

describe("ProductCard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders product name, description, and badges", () => {
    const product = makeProduct();
    const suppliers = { "sup-1": makeSupplier() };
    const onClick = vi.fn();

    render(
      <ProductCard product={product} suppliersById={suppliers} onClick={onClick} />
    );

    expect(screen.getByText("Test Product")).toBeInTheDocument();
    expect(screen.getByText("A test product description")).toBeInTheDocument();
    expect(screen.getByText("ACME Corp")).toBeInTheDocument(); // supplier badge
    expect(screen.getByText("Electronics")).toBeInTheDocument(); // category badge
    expect(screen.getByText("Large")).toBeInTheDocument(); // size badge
  });

  it("renders uncategorized key when category is null", () => {
    const product = makeProduct({ category: null });
    const suppliers = { "sup-1": makeSupplier() };
    const onClick = vi.fn();

    render(
      <ProductCard product={product} suppliersById={suppliers} onClick={onClick} />
    );

    expect(screen.getByText("Uncategorized")).toBeInTheDocument();
  });

  it("does not render size badge when size is null", () => {
    const product = makeProduct({ size: null });
    const suppliers = { "sup-1": makeSupplier() };
    const onClick = vi.fn();

    render(
      <ProductCard product={product} suppliersById={suppliers} onClick={onClick} />
    );

    expect(screen.queryByText("Large")).not.toBeInTheDocument();
  });

  it("renders purchase count with ICU plural", () => {
    const product = makeProduct({ purchase_count: 5 });
    const suppliers = { "sup-1": makeSupplier() };
    const onClick = vi.fn();

    render(
      <ProductCard product={product} suppliersById={suppliers} onClick={onClick} />
    );

    expect(screen.getByText("Purchased 5 times")).toBeInTheDocument();
  });

  it("renders last_purchased_at formatted date when present", () => {
    const product = makeProduct({ last_purchased_at: "2024-05-15T00:00:00Z" });
    const suppliers = { "sup-1": makeSupplier() };
    const onClick = vi.fn();

    render(
      <ProductCard product={product} suppliersById={suppliers} onClick={onClick} />
    );

    // Date should be rendered (exact format depends on Intl.DateTimeFormat)
    expect(screen.getByText(/May 15, 2024/)).toBeInTheDocument();
  });

  it("does not render date separator when last_purchased_at is null", () => {
    const product = makeProduct({ last_purchased_at: null });
    const suppliers = { "sup-1": makeSupplier() };
    const onClick = vi.fn();

    render(
      <ProductCard product={product} suppliersById={suppliers} onClick={onClick} />
    );

    // Should have no separator (·)
    const separator = screen.queryByText("·");
    expect(separator).not.toBeInTheDocument();
  });

  it("renders 'View product' anchor with href and target when product_url set", () => {
    const product = makeProduct({ product_url: "https://shop.example.com/prod-1" });
    const suppliers = { "sup-1": makeSupplier() };
    const onClick = vi.fn();

    render(
      <ProductCard product={product} suppliersById={suppliers} onClick={onClick} />
    );

    const link = screen.getByRole("link", { name: "View product" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "https://shop.example.com/prod-1");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("does not render 'View product' anchor when product_url is null", () => {
    const product = makeProduct({ product_url: null });
    const suppliers = { "sup-1": makeSupplier() };
    const onClick = vi.fn();

    render(
      <ProductCard product={product} suppliersById={suppliers} onClick={onClick} />
    );

    const link = screen.queryByRole("link", { name: "View product" });
    expect(link).not.toBeInTheDocument();
  });

  it("fires onClick when card is clicked", async () => {
    const product = makeProduct();
    const suppliers = { "sup-1": makeSupplier() };
    const onClick = vi.fn();

    render(
      <ProductCard product={product} suppliersById={suppliers} onClick={onClick} />
    );

    const card = screen.getByRole("button");
    await userEvent.click(card);

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("fires onClick when Enter key is pressed on card", () => {
    const product = makeProduct();
    const suppliers = { "sup-1": makeSupplier() };
    const onClick = vi.fn();

    render(
      <ProductCard product={product} suppliersById={suppliers} onClick={onClick} />
    );

    const card = screen.getByRole("button");
    fireEvent.keyDown(card, { key: "Enter" });

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does not fire onClick when clicking product_url anchor", async () => {
    const product = makeProduct({ product_url: "https://shop.example.com/prod-1" });
    const suppliers = { "sup-1": makeSupplier() };
    const onClick = vi.fn();

    render(
      <ProductCard product={product} suppliersById={suppliers} onClick={onClick} />
    );

    const link = screen.getByRole("link", { name: "View product" });
    await userEvent.click(link);

    // onClick should not be called because link.stopPropagation() prevents bubbling
    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders ProductImage component with correct props", () => {
    const product = makeProduct({ id: "prod-123", has_image: true, name: "Widget" });
    const suppliers = { "sup-1": makeSupplier() };
    const onClick = vi.fn();

    render(
      <ProductCard product={product} suppliersById={suppliers} onClick={onClick} />
    );

    const image = screen.getByTestId("product-image");
    expect(image).toHaveAttribute("data-alt", "Widget");
  });

  it("renders supplier badge when supplier exists in suppliersById", () => {
    const product = makeProduct({ supplier_id: "sup-2" });
    const suppliers = {
      "sup-2": makeSupplier({ id: "sup-2", name: "XYZ Supplies" }),
    };
    const onClick = vi.fn();

    render(
      <ProductCard product={product} suppliersById={suppliers} onClick={onClick} />
    );

    expect(screen.getByText("XYZ Supplies")).toBeInTheDocument();
  });

  it("still renders without supplier badge if supplier not in map", () => {
    const product = makeProduct({ supplier_id: "sup-missing" });
    const suppliers = {}; // empty map
    const onClick = vi.fn();

    render(
      <ProductCard product={product} suppliersById={suppliers} onClick={onClick} />
    );

    // Name and other content should still render
    expect(screen.getByText("Test Product")).toBeInTheDocument();
    // But supplier badge should not appear
    expect(screen.queryByText("ACME Corp")).not.toBeInTheDocument();
  });
});
