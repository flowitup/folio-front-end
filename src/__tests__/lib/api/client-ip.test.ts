/**
 * The backend keys its rate limits on the caller's address, and a server-side call reaches
 * it from the frontend container — so what these headers carry decides whether "5 sign-in
 * codes per minute" applies per visitor or to the whole web app at once.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const headerStore = new Map<string, string>();

vi.mock("next/headers", () => ({
  headers: async () => ({ get: (name: string) => headerStore.get(name.toLowerCase()) ?? null }),
}));

const { clientIpHeader } = await import("@/lib/api/client-ip");

describe("clientIpHeader", () => {
  beforeEach(() => headerStore.clear());

  it("sends nothing when the request carries no address — local development", async () => {
    expect(await clientIpHeader()).toEqual({});
  });

  it("prefers cf-connecting-ip, which Cloudflare writes itself", async () => {
    headerStore.set("cf-connecting-ip", "203.0.113.7");
    headerStore.set("x-forwarded-for", "198.51.100.4");
    expect(await clientIpHeader()).toEqual({ "X-Forwarded-For": "203.0.113.7" });
  });

  it("falls back to x-forwarded-for when Cloudflare is not in front", async () => {
    headerStore.set("x-forwarded-for", "203.0.113.7");
    expect(await clientIpHeader()).toEqual({ "X-Forwarded-For": "203.0.113.7" });
  });

  it("takes the last x-forwarded-for entry, not the caller's own claim", async () => {
    headerStore.set("x-forwarded-for", "198.51.100.4, 203.0.113.7");
    expect(await clientIpHeader()).toEqual({ "X-Forwarded-For": "203.0.113.7" });
  });

  it("passes an IPv6 address through", async () => {
    headerStore.set("cf-connecting-ip", "2001:db8::8a2e:370:7334");
    expect(await clientIpHeader()).toEqual({ "X-Forwarded-For": "2001:db8::8a2e:370:7334" });
  });

  it.each([
    ["the placeholder some proxies send", "unknown"],
    ["a quoted token", '"evil"'],
    ["a value carrying CR/LF, which would make fetch throw", "203.0.113.7\r\nX-Evil: 1"],
    ["an oversized blob", "A".repeat(120)],
  ])("sends nothing for %s", async (_label, value) => {
    headerStore.set("x-forwarded-for", value);
    expect(await clientIpHeader()).toEqual({});
  });
});
