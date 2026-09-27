import { describe, it, expect, vi } from "vitest";
import en from "@/messages/en.json";

const { mockJoin } = vi.hoisted(() => ({ mockJoin: vi.fn() }));

vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn().mockResolvedValue({ accessToken: "t" }) }));
vi.mock("@/lib/api/companies/join-code", () => ({
  setJoinCode: vi.fn(),
  revokeJoinCode: vi.fn(),
  joinCompanyByCode: mockJoin,
}));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => (en.companies.errors as Record<string, string>)[key] ?? key,
}));

import { joinCompanyByCodeAction } from "../_actions/companies-actions";

describe("joinCompanyByCodeAction", () => {
  it("says the code is invalid when the API finds no company for it", async () => {
    mockJoin.mockRejectedValue(Object.assign(new Error("HTTP 404"), { status: 404, body: { error: "NotFound" } }));
    expect(await joinCompanyByCodeAction("ABCD1234")).toEqual({
      ok: false,
      error: { code: "invalid_join_code", message: en.companies.errors.invalidJoinCode },
    });
  });

  it("keeps other errors as they were", async () => {
    mockJoin.mockRejectedValue(Object.assign(new Error("HTTP 429"), { status: 429, body: null }));
    const result = await joinCompanyByCodeAction("ABCD1234");
    expect(result).toEqual({ ok: false, error: { code: "rate_limited", message: en.companies.errors.rateLimited } });
  });
});
