import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@/lib/api/auth-header", () => ({
  sessionAuthHeader: vi.fn().mockResolvedValue({ Authorization: "Bearer t" }),
}));

import { updateProfileAction } from "../_actions/profile-actions";

afterEach(() => vi.unstubAllGlobals());

function reply(status: number, body: unknown) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));
}

describe("updateProfileAction — 400 answers", () => {
  it("reports a too-long name as invalid input, not as an invalid phone", async () => {
    reply(400, { error: "ValidationError", message: "Invalid input: display_name, phone" });
    expect(await updateProfileAction({ display_name: "x".repeat(300) })).toEqual({
      success: false,
      error: "invalid_input",
    });
  });

  it("keeps the invalid-phone answer for a bad phone", async () => {
    reply(400, { error: "BadRequest", message: "Invalid phone number" });
    expect(await updateProfileAction({ phone: "123" })).toEqual({ success: false, error: "invalid_phone" });
  });

  it("falls back to unknown for any other 400", async () => {
    reply(400, { error: "BadRequest", message: "No fields to update" });
    expect(await updateProfileAction({})).toEqual({ success: false, error: "unknown" });
  });
});
