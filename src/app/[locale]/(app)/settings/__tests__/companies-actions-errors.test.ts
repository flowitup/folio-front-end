import { describe, it, expect, vi } from "vitest";
import en from "@/messages/en.json";

const { mockUpdate, mockDetach, mockBoot, mockSetRole, mockJoin } = vi.hoisted(() => ({
  mockUpdate: vi.fn(),
  mockDetach: vi.fn(),
  mockBoot: vi.fn(),
  mockSetRole: vi.fn(),
  mockJoin: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn().mockResolvedValue({ accessToken: "t" }) }));
vi.mock("@/lib/api/companies/companies", () => ({
  fetchMyCompanies: vi.fn(),
  fetchAllCompanies: vi.fn(),
  createCompany: vi.fn(),
  updateCompany: mockUpdate,
  deleteCompany: vi.fn(),
  setPrimaryCompany: vi.fn(),
  detachCompany: mockDetach,
}));
vi.mock("@/lib/api/companies/attached-users", () => ({
  fetchAttachedUsers: vi.fn(),
  bootAttachedUser: mockBoot,
  setMemberRole: mockSetRole,
}));
vi.mock("@/lib/api/companies/join-code", () => ({
  setJoinCode: vi.fn(),
  revokeJoinCode: vi.fn(),
  joinCompanyByCode: mockJoin,
}));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => (en.companies.errors as Record<string, string>)[key] ?? key,
}));

import {
  bootAttachedUserAction,
  detachCompanyAction,
  joinCompanyByCodeAction,
  setMemberRoleAction,
  updateCompanyAction,
} from "../_actions/companies-actions";

const COMPANY = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";

const conflict = (reason?: string) =>
  Object.assign(new Error("HTTP 409"), {
    status: 409,
    body: { error: "Conflict", message: "x", ...(reason ? { reason } : {}) },
  });

const lastAdmin = { ok: false, error: { code: "last_admin", message: en.companies.errors.lastAdmin } };

describe("companies actions: 409 reasons", () => {
  it("explains a last-admin refusal when leaving, demoting or removing", async () => {
    mockDetach.mockRejectedValue(conflict("last_admin"));
    mockSetRole.mockRejectedValue(conflict("last_admin"));
    mockBoot.mockRejectedValue(conflict("last_admin"));

    expect(await detachCompanyAction(COMPANY)).toEqual(lastAdmin);
    expect(await setMemberRoleAction(COMPANY, USER, "member")).toEqual(lastAdmin);
    expect(await bootAttachedUserAction(COMPANY, USER)).toEqual(lastAdmin);
  });

  it("says you already belong to the company when joining it again", async () => {
    mockJoin.mockRejectedValue(conflict("company_already_attached"));
    expect(await joinCompanyByCodeAction("ABCD1234")).toEqual({
      ok: false,
      error: { code: "company_already_attached", message: en.companies.errors.companyAlreadyAttached },
    });
  });

  it("keeps the generic message for other conflicts", async () => {
    mockDetach.mockRejectedValue(conflict());
    expect(await detachCompanyAction(COMPANY)).toEqual({
      ok: false,
      error: { code: "conflict", message: en.companies.errors.conflict },
    });
  });
});

describe("updateCompanyAction: 422", () => {
  it("names the fields the API rejected", async () => {
    mockUpdate.mockRejectedValue(
      Object.assign(new Error("HTTP 422"), {
        status: 422,
        body: {
          error: "validation_error",
          details: [
            { loc: ["siret"], msg: "String should match pattern", type: "string_pattern_mismatch" },
            { loc: ["iban"], msg: "Value error, IBAN check digits are wrong", type: "value_error" },
            { loc: ["iban"], msg: "duplicate", type: "value_error" },
          ],
        },
      })
    );
    expect(await updateCompanyAction(COMPANY, { siret: "1", iban: "FR76" })).toEqual({
      ok: false,
      error: { code: "validation", message: en.companies.errors.validation, fields: ["siret", "iban"] },
    });
  });

  it("keeps the plain validation error when the body names no field", async () => {
    mockUpdate.mockRejectedValue(Object.assign(new Error("HTTP 400"), { status: 400, body: null }));
    expect(await updateCompanyAction(COMPANY, { legal_name: "x" })).toEqual({
      ok: false,
      error: { code: "validation", message: en.companies.errors.validation },
    });
  });
});
