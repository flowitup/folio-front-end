/**
 * BibliothequePageClient — the page count uses the API's page size (20), so
 * products past the first 20 stay reachable through pagination.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { BibliothequePageClient } from "../bibliotheque-page-client";
import { listProductsAction } from "@/app/[locale]/(app)/bibliotheque/_actions/bibliotheque-actions";
import type { LibraryProduct } from "@/lib/api/bibliotheque";

const mockUseAuth = vi.fn();

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/en/bibliotheque",
}));

vi.mock("@/app/[locale]/(app)/bibliotheque/_actions/bibliotheque-actions", () => ({
  listSuppliersAction: vi.fn().mockResolvedValue({ ok: true, data: [] }),
  listCategoriesAction: vi.fn().mockResolvedValue({ ok: true, data: [] }),
  listProductsAction: vi.fn(),
  importPurchasesAction: vi.fn(),
}));

function renderPage() {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <BibliothequePageClient companyId="co-1" />
    </NextIntlClientProvider>
  );
}

function product(n: number): LibraryProduct {
  return {
    id: `p-${n}`,
    company_id: "co-1",
    supplier_id: "s-1",
    supplier_reference: `REF-${n}`,
    name: `Product ${n}`,
    description: null,
    size: null,
    category: null,
    has_image: false,
    product_url: null,
    purchase_count: 1,
    total_quantity: "1",
    last_unit_price: null,
    first_purchased_at: null,
    last_purchased_at: null,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
  };
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({ user: { permissions: ["project:read"] } });
  // The API returns 20 products per page whatever the client wants.
  vi.mocked(listProductsAction).mockResolvedValue({
    ok: true,
    data: { items: Array.from({ length: 20 }, (_, i) => product(i + 1)), total: 22, page: 1 },
  });
});

describe("BibliothequePageClient pagination", () => {
  it("offers a second page when the API pages 22 products by 20", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Product 1")).toBeDefined());

    const next = screen.getByRole("button", { name: enMessages.bibliotheque.nextPage });
    expect((next as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText("/ 2")).toBeDefined();
  });
});
