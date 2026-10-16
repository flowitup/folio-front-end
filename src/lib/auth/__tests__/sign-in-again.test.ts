import { describe, it, expect } from "vitest";
import { signInAgainUrl } from "../sign-in-again";

describe("signInAgainUrl", () => {
  it("keeps the current locale and returns to the given page", () => {
    expect(signInAgainUrl("/fr/settings", "/settings")).toBe(
      `/fr/login?callbackUrl=${encodeURIComponent("/fr/settings")}`
    );
  });

  it("falls back to the default locale on an unprefixed path", () => {
    expect(signInAgainUrl("/settings", "/settings")).toBe(
      `/en/login?callbackUrl=${encodeURIComponent("/en/settings")}`
    );
  });
});
