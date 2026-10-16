import { describe, expect, it } from "vitest";
import { routing } from "../routing";

describe("routing", () => {
  it("keeps the chosen language for a year, not just for the browser session", () => {
    const cookie = routing.localeCookie;
    expect(cookie && typeof cookie === "object" ? cookie.maxAge : undefined).toBe(60 * 60 * 24 * 365);
  });
});
