/**
 * CompanyProfileForm — a company admin edits their own company profile. The
 * API masks SIRET / TVA / IBAN / BIC for them ("····7890189"); a masked value
 * must never be shown as the field's value nor sent back, or saving would
 * overwrite the real bank details with the mask.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Company } from "@/types/companies";

vi.mock("next-intl", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const en = require("../../../messages/en.json") as Record<string, unknown>;
  function resolve(obj: Record<string, unknown>, path: string): string {
    return (path.split(".").reduce<unknown>((acc, k) => {
      if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[k];
      return undefined;
    }, obj) as string) ?? path;
  }
  return { useTranslations: (ns: string) => (key: string) => resolve(en, `${ns}.${key}`) };
});

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/app/[locale]/(app)/settings/_actions/companies-actions", () => ({
  updateCompanyAction: vi.fn(),
}));

import { updateCompanyAction } from "@/app/[locale]/(app)/settings/_actions/companies-actions";
import { CompanyProfileForm, buildCompanyUpdatePayload, initialProfileValues } from "../company-profile-form";

const mockUpdate = vi.mocked(updateCompanyAction);

function makeCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: "c1",
    legal_name: "Maison Lavandou",
    address: "12 rue des Oliviers",
    siret: "····8900012",
    tva_number: "····78901",
    iban: "····7890189",
    bic: "····PPXXX",
    logo_url: null,
    default_payment_terms: null,
    prefix_override: null,
    created_by: "u1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdate.mockImplementation(async (_id, payload) => ({
    ok: true,
    data: { ...makeCompany(), ...payload } as Company,
  }));
});

describe("CompanyProfileForm", () => {
  it("starts masked fields empty, with the mask only as a placeholder", () => {
    render(<CompanyProfileForm company={makeCompany()} />);
    const iban = screen.getByLabelText("IBAN") as HTMLInputElement;
    expect(iban.value).toBe("");
    expect(iban.placeholder).toBe("····7890189");
    expect((screen.getByLabelText(/Legal name/) as HTMLInputElement).value).toBe("Maison Lavandou");
  });

  it("does not send masked SIRET / TVA / IBAN / BIC back when they were not edited", async () => {
    const onSaved = vi.fn();
    render(<CompanyProfileForm company={makeCompany()} onSaved={onSaved} />);

    fireEvent.change(screen.getByLabelText(/Legal name/), { target: { value: "Maison Lavandou SARL" } });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    const payload = mockUpdate.mock.calls[0][1];
    expect(payload.legal_name).toBe("Maison Lavandou SARL");
    for (const key of ["siret", "tva_number", "iban", "bic"] as const) {
      expect(payload).not.toHaveProperty(key);
    }
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it("sends a sensitive field only once the admin types a new value", async () => {
    render(<CompanyProfileForm company={makeCompany()} />);

    fireEvent.change(screen.getByLabelText("IBAN"), {
      target: { value: "FR7630006000011234567890189" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    const payload = mockUpdate.mock.calls[0][1];
    expect(payload.iban).toBe("FR7630006000011234567890189");
    expect(payload).not.toHaveProperty("bic");
    expect(payload).not.toHaveProperty("siret");
  });

  it("prefills full values (platform ops) and still omits them when unchanged", () => {
    const company = makeCompany({ iban: "FR7630006000011234567890189", bic: "BNPAFRPPXXX" });
    const values = initialProfileValues(company);
    expect(values.iban).toBe("FR7630006000011234567890189");
    expect(buildCompanyUpdatePayload(company, values)).not.toHaveProperty("iban");
  });
});
