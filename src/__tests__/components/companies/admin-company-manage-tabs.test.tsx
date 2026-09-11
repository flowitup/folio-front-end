/**
 * admin-company-manage-tabs.test.tsx
 *
 * Required regression test:
 *   test_admin_company_manage_tabs_render
 *
 * Also covers: tab switching, company-code tab render.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AdminCompanyManagePage } from "@/components/companies/admin-company-manage-page";
import type { Company, AttachedUser } from "@/types/companies";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("next-intl", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const en = require("../../../messages/en.json") as Record<string, unknown>;
  function resolve(obj: Record<string, unknown>, path: string): string {
    return path.split(".").reduce<unknown>((acc, k) => {
      if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[k];
      return undefined;
    }, obj) as string ?? path;
  }
  const makeT = (ns: string) => (key: string, params?: Record<string, unknown>) => {
    let val = resolve(en, `${ns}.${key}`);
    if (typeof val !== "string") return key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => { val = val.replace(`{${k}}`, String(v)); });
    }
    return val;
  };
  return {
    useTranslations: (ns: string) => makeT(ns),
    useLocale: () => "en",
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  } as unknown as { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> },
}));

vi.mock(
  "@/app/[locale]/(app)/settings/_actions/companies-actions",
  () => ({
    updateCompanyAction: vi.fn(),
    deleteCompanyAction: vi.fn(),
    setJoinCodeAction: vi.fn(),
    revokeJoinCodeAction: vi.fn(),
    fetchAttachedUsersAction: vi.fn().mockResolvedValue({ ok: true, data: [] }),
  })
);

vi.mock(
  "@/app/[locale]/(app)/settings/companies/[id]/_actions/payment-methods-actions",
  () => ({
    listPaymentMethodsAction: vi.fn(),
  })
);

// PaymentMethodsSection is a client component with its own mutation logic.
// Stub it so payments-tab tests only exercise the fetch + render path in
// AdminCompanyManagePage without pulling in the full section dependency tree.
vi.mock(
  "@/app/[locale]/(app)/settings/companies/[id]/_components/payment-methods-section",
  () => ({
    PaymentMethodsSection: ({ initial }: { initial: unknown[] }) => (
      <div data-testid="payment-methods-section">
        {initial.length} methods
      </div>
    ),
  })
);

import { listPaymentMethodsAction } from "@/app/[locale]/(app)/settings/companies/[id]/_actions/payment-methods-actions";
const mockListPaymentMethods = vi.mocked(listPaymentMethodsAction);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const COMPANY: Company = {
  id: "co-1",
  legal_name: "ACME Corp",
  address: "12 Rue de la Paix, 75001 Paris",
  siret: "12345678900012",
  tva_number: null,
  iban: null,
  bic: null,
  logo_url: null,
  default_payment_terms: null,
  prefix_override: null,
  created_by: "user-admin",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const INITIAL_USERS: AttachedUser[] = [
  {
    user_id: "user-1",
    email: "alice@example.com",
    display_name: "Alice",
    phone: null,
    is_primary: true,
    attached_at: "2026-01-01T00:00:00Z",
    role: "admin",
  },
];

function renderPage(users: AttachedUser[] = INITIAL_USERS) {
  return render(
    <AdminCompanyManagePage company={COMPANY} initialUsers={users} />
  );
}

// ---------------------------------------------------------------------------
// test_admin_company_manage_tabs_render
// ---------------------------------------------------------------------------

describe("test_admin_company_manage_tabs_render", () => {
  it("renders the Edit, Company code, Attached users and Delete tabs", () => {
    renderPage();

    // Tab labels come from i18n: "Edit", "Company code", "Attached users", "Delete"
    expect(screen.getByRole("button", { name: /^edit$/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /^company code$/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /attached users/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /^delete$/i })).toBeDefined();
  });

  it("Edit tab is active by default (shows save changes button in form)", () => {
    renderPage();
    // Edit tab panel: form with "Save changes" button (i18n key: admin.manage.edit.save)
    expect(screen.getByRole("button", { name: /save changes/i })).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Tab switching
// ---------------------------------------------------------------------------

describe("AdminCompanyManagePage — tab switching", () => {
  beforeEach(() => vi.clearAllMocks());

  it("clicking Company code tab shows the reusable join-code card", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /^company code$/i }));

    await waitFor(() => {
      // The reusable company join code card — empty state since the fixture
      // company has no join_code set.
      expect(screen.getByTestId("company-join-code-card")).toBeDefined();
      expect(screen.getByTestId("company-join-code-empty")).toBeDefined();
      expect(screen.getByRole("button", { name: /create code/i })).toBeDefined();
    });
  });

  it("clicking Attached users tab shows the attached users table", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /attached users/i }));

    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeDefined();
    });
  });

  it("clicking Delete tab shows destructive delete button", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      // The delete zone renders a red-styled delete confirm button
      const btns = screen.getAllByRole("button");
      const deleteBtns = btns.filter((b) =>
        /delete|remove/i.test(b.textContent ?? "")
      );
      expect(deleteBtns.length).toBeGreaterThan(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Payments tab — mount, fetch, error, and re-activation
// ---------------------------------------------------------------------------

const PAYMENT_METHODS = [
  { id: "pm-1", companyId: "co-1", label: "Cash", isBuiltin: true, isActive: true, usageCount: 0, isCompanyPayment: false, isPersonalPayment: false },
  { id: "pm-2", companyId: "co-1", label: "Wise", isBuiltin: false, isActive: true, usageCount: 1, isCompanyPayment: false, isPersonalPayment: false },
];

describe("AdminCompanyManagePage — payments tab", () => {
  beforeEach(() => vi.clearAllMocks());

  it(
    "activating the payments tab calls listPaymentMethodsAction and renders section with data",
    async () => {
      mockListPaymentMethods.mockResolvedValueOnce({ ok: true, data: PAYMENT_METHODS });

      renderPage();
      fireEvent.click(screen.getByRole("button", { name: /payment methods/i }));

      await waitFor(() => {
        expect(mockListPaymentMethods).toHaveBeenCalledWith("co-1");
        expect(screen.getByTestId("payment-methods-section")).toBeDefined();
        expect(screen.getByText("2 methods")).toBeDefined();
      });
    },
    15000,
  );

  it(
    "failed listPaymentMethodsAction shows the error message",
    async () => {
      mockListPaymentMethods.mockResolvedValueOnce({
        ok: false,
        error: { code: "permission_denied", message: "Forbidden" },
      });

      renderPage();
      fireEvent.click(screen.getByRole("button", { name: /payment methods/i }));

      await waitFor(() => {
        // i18n key: companies.admin.manage.paymentsLoadError
        const el = screen.queryByText(/failed to load payment methods/i);
        expect(el).not.toBeNull();
      });
    },
    15000,
  );

  it(
    "re-activating the payments tab refetches (call count reaches 2 after tab round-trip)",
    async () => {
      mockListPaymentMethods
        .mockResolvedValueOnce({ ok: true, data: PAYMENT_METHODS })
        .mockResolvedValueOnce({ ok: true, data: PAYMENT_METHODS });

      renderPage();

      // First activation
      fireEvent.click(screen.getByRole("button", { name: /payment methods/i }));
      await waitFor(() => {
        expect(mockListPaymentMethods).toHaveBeenCalledTimes(1);
      });

      // Switch away
      fireEvent.click(screen.getByRole("button", { name: /^edit$/i }));

      // Second activation
      fireEvent.click(screen.getByRole("button", { name: /payment methods/i }));
      await waitFor(() => {
        expect(mockListPaymentMethods).toHaveBeenCalledTimes(2);
      });
    },
    15000,
  );
});
