import { describe, expect, it } from "vitest";
import type { User } from "@/lib/auth/types";
import {
  accessSignature,
  createRefreshThrottle,
  sessionEndedLoginPath,
} from "../session-freshness";

function user(overrides: Partial<User> = {}): User {
  return {
    id: "u1",
    email: "u1@example.com",
    permissions: ["project:read", "invoice:read"],
    companies: [
      { id: "a", legal_name: "Alpha", role: "member", is_primary: true },
      { id: "b", legal_name: "Bêta", role: "manager", is_primary: false },
    ],
    ...overrides,
  };
}

describe("accessSignature", () => {
  it("is empty without a user", () => {
    expect(accessSignature(null)).toBe("");
    expect(accessSignature(undefined)).toBe("");
  });

  it("changes when another admin promotes the user in one company", () => {
    const before = user();
    const after = user({
      companies: [
        { id: "a", legal_name: "Alpha", role: "member", is_primary: true },
        { id: "b", legal_name: "Bêta", role: "admin", is_primary: false },
      ],
    });
    expect(accessSignature(after)).not.toBe(accessSignature(before));
  });

  it("changes with the global permissions and the hidden sections", () => {
    expect(accessSignature(user({ permissions: ["project:read"] }))).not.toBe(
      accessSignature(user())
    );
    const hidden = user({
      companies: [
        { id: "a", legal_name: "Alpha", role: "member", is_primary: true, hidden_sections: ["documents"] },
        { id: "b", legal_name: "Bêta", role: "manager", is_primary: false },
      ],
    });
    expect(accessSignature(hidden)).not.toBe(accessSignature(user()));
  });

  it("ignores order and fields that do not decide access (names)", () => {
    const reordered = user({
      permissions: ["invoice:read", "project:read"],
      display_name: "Renamed",
      companies: [
        { id: "b", legal_name: "Bêta SARL", role: "manager", is_primary: false },
        { id: "a", legal_name: "Alpha", role: "member", is_primary: true },
      ],
    });
    expect(accessSignature(reordered)).toBe(accessSignature(user()));
  });
});

describe("createRefreshThrottle", () => {
  it("waits the gap after the page load, then lets one run at a time", () => {
    let now = 1_000;
    const throttle = createRefreshThrottle(() => now);
    expect(throttle.tryStart(30_000)).toBe(false);
    now += 30_000;
    expect(throttle.tryStart(30_000)).toBe(true);
    // In flight: even a short gap is refused.
    now += 10_000;
    expect(throttle.tryStart(5_000)).toBe(false);
    throttle.finish();
    expect(throttle.tryStart(5_000)).toBe(true);
    throttle.finish();
    // Within the 30 s window of the last run.
    now += 1_000;
    expect(throttle.tryStart(30_000)).toBe(false);
  });
});

describe("sessionEndedLoginPath", () => {
  it("names the reason and comes back to the page", () => {
    expect(sessionEndedLoginPath("/fr/projects/p1/planning", "fr")).toBe(
      "/fr/login?callbackUrl=%2Ffr%2Fprojects%2Fp1%2Fplanning&reason=session_ended"
    );
  });

  it("still names the reason without a usable page to return to", () => {
    expect(sessionEndedLoginPath("//evil.example", "en")).toBe("/en/login?reason=session_ended");
  });
});
