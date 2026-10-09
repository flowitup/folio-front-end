/**
 * calendarDaysFromToday counts the viewer's calendar days, not UTC days and
 * not 24 h periods.
 */

import { describe, it, expect, afterEach } from "vitest";
import { calendarDaysFromToday } from "../local-day";

const savedTz = process.env.TZ;

afterEach(() => {
  if (savedTz === undefined) delete process.env.TZ;
  else process.env.TZ = savedTz;
});

describe("calendarDaysFromToday", () => {
  it("calls yesterday evening 'yesterday' early the next morning (Paris)", () => {
    process.env.TZ = "Europe/Paris";
    // Saved 9 Oct 19:03, viewed 10 Oct 05:00: only 10 h apart.
    expect(calendarDaysFromToday(new Date("2026-10-09T17:03:00Z"), new Date("2026-10-10T03:00:00Z"))).toBe(-1);
  });

  it("calls this morning 'today' late the same evening (Paris)", () => {
    process.env.TZ = "Europe/Paris";
    // Saved 9 Oct 08:00, viewed 9 Oct 22:30: 14.5 h apart, same day.
    expect(calendarDaysFromToday(new Date("2026-10-09T06:00:00Z"), new Date("2026-10-09T20:30:00Z"))).toBe(0);
  });

  it("uses the local day, not the UTC one (Hanoi)", () => {
    process.env.TZ = "Asia/Ho_Chi_Minh";
    // 10 Oct 01:13 Hanoi is still 9 Oct in UTC; viewed 10 Oct 10:00 Hanoi.
    expect(calendarDaysFromToday(new Date("2026-10-09T18:13:00Z"), new Date("2026-10-10T03:00:00Z"))).toBe(0);
    // 9 Oct 23:48 Hanoi viewed 10 Oct 05:00 Hanoi (both 9 Oct in UTC).
    expect(calendarDaysFromToday(new Date("2026-10-09T16:48:00Z"), new Date("2026-10-09T22:00:00Z"))).toBe(-1);
  });

  it("counts whole days across a daylight-saving change", () => {
    process.env.TZ = "Europe/Paris";
    // 24 Oct 12:00 to 26 Oct 00:30: the 25th has 25 hours.
    expect(calendarDaysFromToday(new Date("2026-10-24T10:00:00Z"), new Date("2026-10-25T23:30:00Z"))).toBe(-2);
    expect(calendarDaysFromToday(new Date("2026-10-27T10:00:00Z"), new Date("2026-10-25T23:30:00Z"))).toBe(1);
  });

  it("returns NaN for an invalid date", () => {
    expect(calendarDaysFromToday(new Date("not a date"))).toBeNaN();
  });
});
