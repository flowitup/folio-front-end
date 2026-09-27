/**
 * BibliothequePageClient — the purchase Import action follows the
 * bibliotheque:manage permission the import endpoint requires.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { BibliothequePageClient } from "../bibliotheque-page-client";

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
  listProductsAction: vi
    .fn()
    .mockResolvedValue({ ok: true, data: { items: [], total: 0, page: 1 } }),
  importPurchasesAction: vi.fn(),
}));

function renderPage() {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <BibliothequePageClient companyId="co-1" />
    </NextIntlClientProvider>
  );
}

beforeEach(() => mockUseAuth.mockReset());

describe("BibliothequePageClient import action", () => {
  it("opens the purchase import for a library manager", async () => {
    mockUseAuth.mockReturnValue({ user: { permissions: ["bibliotheque:manage"] } });
    renderPage();
    await waitFor(() => expect(screen.getByText(enMessages.bibliotheque.noResults)).toBeDefined());

    fireEvent.click(screen.getByRole("button", { name: "Import" }));

    expect(screen.getByText("Import purchases")).toBeDefined();
  });

  it("is hidden without bibliotheque:manage", async () => {
    mockUseAuth.mockReturnValue({ user: { permissions: ["project:read"] } });
    renderPage();
    await waitFor(() => expect(screen.getByText(enMessages.bibliotheque.noResults)).toBeDefined());

    expect(screen.queryByRole("button", { name: "Import" })).toBeNull();
  });
});
