/**
 * Telling the hourly SMS-code cap (`OtpHourlyLimit`, up to an hour) apart from
 * the short resend gap, so the user is told how long to wait instead of "wait a minute".
 */

import { describe, it, expect } from "vitest";
import { hourlyLimitMinutes, hourlyLimitMinutesOf } from "../otp-throttle";

describe("hourlyLimitMinutes", () => {
  it("rounds the Retry-After seconds up to whole minutes", () => {
    expect(hourlyLimitMinutes("OtpHourlyLimit", "3290")).toBe(55);
    expect(hourlyLimitMinutes("OtpHourlyLimit", "61")).toBe(2);
    expect(hourlyLimitMinutes("OtpHourlyLimit", "1")).toBe(1);
  });

  it("assumes the longest wait when Retry-After is missing or unreadable", () => {
    expect(hourlyLimitMinutes("OtpHourlyLimit", null)).toBe(60);
    expect(hourlyLimitMinutes("OtpHourlyLimit", "soon")).toBe(60);
  });

  it("is null for the short resend gap", () => {
    expect(hourlyLimitMinutes("TooManyRequests", "60")).toBeNull();
    expect(hourlyLimitMinutes(undefined, "3290")).toBeNull();
  });
});

describe("hourlyLimitMinutesOf", () => {
  it("reads the error code and Retry-After from a 429 response", async () => {
    const capped = new Response(JSON.stringify({ error: "OtpHourlyLimit" }), {
      status: 429,
      headers: { "Retry-After": "3290" },
    });
    await expect(hourlyLimitMinutesOf(capped)).resolves.toBe(55);

    const gap = new Response(JSON.stringify({ error: "TooManyRequests" }), {
      status: 429,
      headers: { "Retry-After": "60" },
    });
    await expect(hourlyLimitMinutesOf(gap)).resolves.toBeNull();
  });

  it("is null when the body is not JSON", async () => {
    await expect(hourlyLimitMinutesOf(new Response("Too Many Requests", { status: 429 }))).resolves.toBeNull();
  });
});
