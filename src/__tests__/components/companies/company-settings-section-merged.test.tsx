/**
 * company-settings-section-merged.test.tsx
 *
 * Pins the merge of the old "My companies" tab into "Company": one section now
 * carries both the caller's attachment (identity card) and — only when the
 * caller admins the SELECTED company — the admin tools (join code, the
 * members table, payment methods). A manager or member must see their company
 * without any of the admin surface, which would only 403 for them.
 *
 * The picker is the one interaction the merge introduces, so switching it is
 * covered here: it must re-gate the admin half AND remount the admin children,
 * which hold per-company state (the join code is a credential — showing one
 * company's code under another's name would hand out the wrong invite).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { MyCompany } from "@/types/companies";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

/** Props each admin child was last rendered with, for contract assertions. */
const captured = vi.hoisted(() => ({
  members: [] as Array<{
    companyId: string;
    adminOfMultiple: boolean;
    sourceCompanies: MyCompany[];
  }>,
}));

vi.mock("next-intl", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const en = require("../../../messages/en.json") as Record<string, unknown>;
  function resolve(obj: Record<string, unknown>, path: string): string {
    return (path.split(".").reduce<unknown>((acc, k) => {
      if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[k];
      return undefined;
    }, obj) as string) ?? path;
  }
  const makeT = (ns: string) => (key: string, params?: Record<string, unknown>) => {
    let val = resolve(en, `${ns}.${key}`);
    if (typeof val !== "string") return key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        val = val.replace(`{${k}}`, String(v));
      });
    }
    return val;
  };
  return { useTranslations: (ns: string) => makeT(ns) };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/app/[locale]/(app)/settings/_actions/companies-actions", () => ({
  fetchMyCompaniesAction: vi.fn(),
  setPrimaryCompanyAction: vi.fn(),
  detachCompanyAction: vi.fn(),
}));

// Radix Select needs pointer APIs jsdom lacks — swap in a native <select>,
// the same shape used by create-project-dialog-company-picker.test.tsx.
vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (v: string) => void;
    children: React.ReactNode;
  }) => (
    <select
      aria-label="Company picker"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

// The real join-code card seeds useState from `initialCode` and never re-syncs
// it, so this stub mirrors that: it goes stale across a company switch unless
// the parent remounts it. That is precisely the regression guarded below.
vi.mock("@/components/companies/company-join-code-card", () => ({
  CompanyJoinCodeCard: ({
    companyId,
    initialCode,
  }: {
    companyId: string;
    initialCode: string | null;
  }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useState } = require("react") as typeof import("react");
    const [code] = useState(initialCode);
    return (
      <div data-testid="join-code-card" data-company={companyId} data-code={code ?? "none"} />
    );
  },
}));

vi.mock("@/components/companies/company-members-table", () => ({
  CompanyMembersTable: (props: {
    companyId: string;
    adminOfMultiple: boolean;
    sourceCompanies: MyCompany[];
  }) => {
    captured.members.push({
      companyId: props.companyId,
      adminOfMultiple: props.adminOfMultiple,
      sourceCompanies: props.sourceCompanies,
    });
    return <div data-testid="members-table" data-company={props.companyId} />;
  },
}));

vi.mock("@/components/companies/company-payment-methods-card", () => ({
  CompanyPaymentMethodsCard: ({ companyId }: { companyId: string }) => (
    <div data-testid="payment-methods-card" data-company={companyId} />
  ),
}));


vi.mock("@/components/companies/join-company-dialog", () => ({
  JoinCompanyDialog: () => <div data-testid="join-company-dialog" />,
}));

import { CompanySettingsSection } from "@/components/companies/company-settings-section";
import { fetchMyCompaniesAction } from "@/app/[locale]/(app)/settings/_actions/companies-actions";

const mockFetch = vi.mocked(fetchMyCompaniesAction);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeCompany(overrides: Partial<MyCompany> = {}): MyCompany {
  return {
    id: "c1",
    legal_name: "Maison Lavandou",
    address: "12 rue des Oliviers, 83980 Le Lavandou",
    siret: "····8900012",
    tva_number: "····78901",
    iban: "····7890189",
    bic: "····PPXXX",
    logo_url: null,
    default_payment_terms: null,
    prefix_override: null,
    join_code: null,
    created_by: "u1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    is_primary: true,
    attached_at: "2026-01-01T00:00:00Z",
    role: "admin",
    ...overrides,
  };
}

function resolveWith(companies: MyCompany[]) {
  mockFetch.mockResolvedValue({ ok: true, data: companies });
}

const lastMembersProps = () => captured.members[captured.members.length - 1];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CompanySettingsSection (merged Company tab)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    captured.members.length = 0;
  });

  it("shows the attachment card and the admin tools for a company admin", async () => {
    resolveWith([makeCompany({ role: "admin" })]);
    render(<CompanySettingsSection />);

    // Section heading, like every other settings tab.
    expect(await screen.findByRole("heading", { name: "Company" })).toBeDefined();

    // Attachment half — the card that used to live under "My companies".
    expect(screen.getByText("Maison Lavandou")).toBeDefined();
    // Named once, by the card: a single attachment needs no picker echoing it.
    expect(screen.getAllByText("Maison Lavandou")).toHaveLength(1);
    expect(screen.getByRole("button", { name: /Set as primary/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Detach/i })).toBeDefined();

    // Admin half.
    expect(screen.getByTestId("join-code-card")).toBeDefined();
    expect(screen.getByTestId("members-table")).toBeDefined();
    expect(screen.getByTestId("payment-methods-card")).toBeDefined();
  });

  it("hides the admin tools when the caller is only a member of the company", async () => {
    resolveWith([makeCompany({ role: "member" })]);
    render(<CompanySettingsSection />);

    // Attachment half still renders — this is the caller's own company.
    expect(await screen.findByText("Maison Lavandou")).toBeDefined();
    expect(screen.getByRole("button", { name: /Detach/i })).toBeDefined();

    // Admin half must not: those endpoints would 403 for a member.
    expect(screen.queryByTestId("join-code-card")).toBeNull();
    expect(screen.queryByTestId("members-table")).toBeNull();
    expect(screen.queryByTestId("payment-methods-card")).toBeNull();
  });

  it("hides the admin tools for a manager too", async () => {
    resolveWith([makeCompany({ role: "manager" })]);
    render(<CompanySettingsSection />);

    expect(await screen.findByText("Maison Lavandou")).toBeDefined();
    expect(screen.queryByTestId("members-table")).toBeNull();
    expect(screen.queryByTestId("payment-methods-card")).toBeNull();
  });

  it("renders no picker for a single company, and one for several", async () => {
    resolveWith([makeCompany()]);
    const single = render(<CompanySettingsSection />);
    await screen.findByTestId("members-table");
    expect(screen.queryByLabelText("Company picker")).toBeNull();
    single.unmount();

    resolveWith([
      makeCompany(),
      makeCompany({ id: "c2", legal_name: "Atelier Sud", is_primary: false, role: "member" }),
    ]);
    render(<CompanySettingsSection />);
    expect(await screen.findByLabelText("Company picker")).toBeDefined();
  });

  it("defaults to the primary company when the caller has several", async () => {
    resolveWith([
      makeCompany({ id: "c1", legal_name: "Atelier Sud", is_primary: false, role: "member" }),
      makeCompany({ id: "c2", legal_name: "Maison Lavandou", is_primary: true, role: "admin" }),
    ]);
    render(<CompanySettingsSection />);

    // The primary one drives the section, so its admin tools show.
    const members = await screen.findByTestId("members-table");
    expect(members.getAttribute("data-company")).toBe("c2");
  });

  it("switching the picker re-gates the admin half", async () => {
    resolveWith([
      makeCompany({ id: "c1", legal_name: "Maison Lavandou", is_primary: true, role: "member" }),
      makeCompany({ id: "c2", legal_name: "Atelier Sud", is_primary: false, role: "admin" }),
    ]);
    render(<CompanySettingsSection />);

    const picker = await screen.findByLabelText("Company picker");
    // Starts on the primary, where the caller is only a member.
    expect(screen.queryByTestId("members-table")).toBeNull();

    fireEvent.change(picker, { target: { value: "c2" } });

    // Admin of the newly selected company — the tools appear.
    await waitFor(() => {
      expect(screen.getByTestId("members-table").getAttribute("data-company")).toBe("c2");
    });

    // And switching back hides them again.
    fireEvent.change(picker, { target: { value: "c1" } });
    await waitFor(() => {
      expect(screen.queryByTestId("members-table")).toBeNull();
    });
  });

  it("remounts the join-code card on an admin-to-admin switch so no stale code is shown", async () => {
    resolveWith([
      makeCompany({ id: "c1", legal_name: "Maison Lavandou", is_primary: true, role: "admin", join_code: "AAAA1111" }),
      makeCompany({ id: "c2", legal_name: "Atelier Sud", is_primary: false, role: "admin", join_code: "BBBB2222" }),
    ]);
    render(<CompanySettingsSection />);

    const card = await screen.findByTestId("join-code-card");
    expect(card.getAttribute("data-code")).toBe("AAAA1111");

    fireEvent.change(screen.getByLabelText("Company picker"), { target: { value: "c2" } });

    // Both halves must move together: the code shown belongs to the company
    // named above it, not to the one we just switched away from.
    await waitFor(() => {
      const next = screen.getByTestId("join-code-card");
      expect(next.getAttribute("data-company")).toBe("c2");
      expect(next.getAttribute("data-code")).toBe("BBBB2222");
    });
  });

  it("repoints the payment-methods card on an admin-to-admin switch", async () => {
    resolveWith([
      makeCompany({ id: "c1", legal_name: "Maison Lavandou", is_primary: true, role: "admin" }),
      makeCompany({ id: "c2", legal_name: "Atelier Sud", is_primary: false, role: "admin" }),
    ]);
    render(<CompanySettingsSection />);

    const card = await screen.findByTestId("payment-methods-card");
    expect(card.getAttribute("data-company")).toBe("c1");

    fireEvent.change(screen.getByLabelText("Company picker"), { target: { value: "c2" } });

    // The card is keyed by company id on purpose: PaymentMethodsSection seeds
    // its list from `initial` once, so without the remount a switch would leave
    // the previous company's methods on screen under the new company's name.
    await waitFor(() => {
      expect(screen.getByTestId("payment-methods-card").getAttribute("data-company")).toBe("c2");
    });
  });

  it("offers 'import from company' only the other companies the caller admins", async () => {
    resolveWith([
      makeCompany({ id: "c1", legal_name: "Maison Lavandou", is_primary: true, role: "admin" }),
      makeCompany({ id: "c2", legal_name: "Atelier Sud", is_primary: false, role: "admin" }),
      makeCompany({ id: "c3", legal_name: "Chantier Nord", is_primary: false, role: "member" }),
    ]);
    render(<CompanySettingsSection />);
    await screen.findByTestId("members-table");

    const props = lastMembersProps();
    expect(props.companyId).toBe("c1");
    // Two admin companies in total, so the import affordance is offered…
    expect(props.adminOfMultiple).toBe(true);
    // …but only over the OTHER admin company — never the member-only one,
    // whose roster the caller cannot read (the backend would 403).
    expect(props.sourceCompanies.map((c) => c.id)).toEqual(["c2"]);
  });

  it("does not offer 'import from company' when only one company is administered", async () => {
    resolveWith([
      makeCompany({ id: "c1", is_primary: true, role: "admin" }),
      makeCompany({ id: "c2", legal_name: "Chantier Nord", is_primary: false, role: "member" }),
    ]);
    render(<CompanySettingsSection />);
    await screen.findByTestId("members-table");

    expect(lastMembersProps().adminOfMultiple).toBe(false);
    expect(lastMembersProps().sourceCompanies).toEqual([]);
  });

  it("offers the attach-a-company CTA when nothing is attached yet", async () => {
    resolveWith([]);
    render(<CompanySettingsSection />);

    expect(await screen.findByText("No companies attached yet")).toBeDefined();
    expect(screen.getByRole("button", { name: /Add company/i })).toBeDefined();
    expect(screen.queryByTestId("members-table")).toBeNull();
  });

  it("reports a failed load instead of claiming the caller has no company", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      error: { code: "generic", message: "boom" },
    } as Awaited<ReturnType<typeof fetchMyCompaniesAction>>);
    render(<CompanySettingsSection />);

    // A 500/401 must not read as "you belong to nowhere, go redeem a token".
    expect(await screen.findByText(/Could not load your companies/i)).toBeDefined();
    expect(screen.queryByText("No companies attached yet")).toBeNull();

    // Retry refetches, and a subsequent success clears the error.
    resolveWith([makeCompany({ role: "admin" })]);
    fireEvent.click(screen.getByRole("button", { name: /Retry/i }));

    await waitFor(() => {
      expect(screen.getByTestId("members-table")).toBeDefined();
    });
    expect(screen.queryByText(/Could not load your companies/i)).toBeNull();
  });
});
