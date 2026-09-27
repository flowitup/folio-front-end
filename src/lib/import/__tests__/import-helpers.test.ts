/**
 * Shared import helpers: CSV reading, value normalisation, rate-limit retry
 * and file decoding.
 */

import { describe, it, expect, vi } from "vitest";
import { detectCsvDelimiter, parseCsv, toCsvCell } from "@/lib/import/csv";
import {
  cleanText,
  detectDateOrder,
  isAmbiguousDate,
  isIsoDateTime,
  isPlausibleEmail,
  normalizeDecimal,
  normalizeIsoDate,
} from "@/lib/import/normalize";
import { MAX_ACTION_PAYLOAD_BYTES, jsonByteLength } from "@/lib/import/payload-size";
import { abortableSleep, callWithRateLimitRetry } from "@/lib/import/rate-limit-retry";
import { readImportFileText } from "@/lib/import/read-text-file";

describe("parseCsv", () => {
  it("detects the delimiter used by French Excel exports", () => {
    expect(detectCsvDelimiter("a;b;c\n1;2;3")).toBe(";");
    expect(detectCsvDelimiter("a,b,c")).toBe(",");
    expect(detectCsvDelimiter("a\tb\tc")).toBe("\t");
    // A comma inside a quoted header does not count.
    expect(detectCsvDelimiter('"x,y";b;c')).toBe(";");
  });

  it("reads quoted cells with delimiters, doubled quotes and line breaks", () => {
    const rows = parseCsv('name;note\r\n"Dupont; SARL";"said ""hi""\nthen left"\r\n');
    expect(rows).toEqual([
      { line: 1, cells: ["name", "note"] },
      { line: 2, cells: ["Dupont; SARL", 'said "hi"\nthen left'] },
    ]);
  });

  it("drops the byte-order mark and blank rows, and keeps file line numbers", () => {
    const rows = parseCsv("﻿a,b\n\n1,2\n,\n3,4");
    expect(rows.map((r) => r.line)).toEqual([1, 3, 5]);
    expect(rows[0].cells).toEqual(["a", "b"]);
    expect(rows[2].cells).toEqual(["3", "4"]);
  });

  it("quotes a cell only when needed", () => {
    expect(toCsvCell("plain", ";")).toBe("plain");
    expect(toCsvCell("a;b", ";")).toBe('"a;b"');
    expect(toCsvCell('say "x"', ",")).toBe('"say ""x"""');
  });
});

describe("normalizeDecimal", () => {
  it.each([
    ["12,5", "12.5"],
    ["1 234,56 €", "1234.56"],
    ["1.234,56", "1234.56"],
    ["1,234.56", "1234.56"],
    ["20 %", "20"],
    [" 3 ", "3"],
  ])("reads %j as %j", (input, expected) => {
    expect(normalizeDecimal(input)).toBe(expected);
  });

  it("keeps JSON numbers as written and rejects the unreadable", () => {
    expect(normalizeDecimal(0.1)).toBe("0.1");
    expect(normalizeDecimal("")).toBeNull();
    expect(normalizeDecimal("abc")).toBeNull();
    expect(normalizeDecimal("1,234,5")).toBeNull();
    expect(normalizeDecimal(Number.NaN)).toBeNull();
    expect(normalizeDecimal(null)).toBeNull();
  });
});

describe("normalizeIsoDate", () => {
  it("accepts ISO and day-first dates", () => {
    expect(normalizeIsoDate("2025-03-14")).toBe("2025-03-14");
    expect(normalizeIsoDate("2025-03-14T10:00:00Z")).toBe("2025-03-14");
    expect(normalizeIsoDate("14/03/2025")).toBe("2025-03-14");
    expect(normalizeIsoDate("4.3.2025")).toBe("2025-03-04");
  });

  it("rejects impossible or ambiguous dates", () => {
    expect(normalizeIsoDate("2025-02-30")).toBeNull();
    expect(normalizeIsoDate("31/02/2025")).toBeNull();
    expect(normalizeIsoDate("03/14/25")).toBeNull();
    expect(normalizeIsoDate(20250314)).toBeNull();
  });

  it("reads month-first dates when asked, and only unmistakable ones without an order", () => {
    expect(normalizeIsoDate("03/14/2025", "mdy")).toBe("2025-03-14");
    expect(normalizeIsoDate("03/04/2025", "mdy")).toBe("2025-03-04");
    expect(normalizeIsoDate("14/03/2025", "mdy")).toBeNull();
    expect(normalizeIsoDate("03/04/2025", null)).toBeNull();
    expect(normalizeIsoDate("14/03/2025", null)).toBe("2025-03-14");
    expect(normalizeIsoDate("03/14/2025", null)).toBe("2025-03-14");
    expect(normalizeIsoDate("05/05/2025", null)).toBe("2025-05-05");
    expect(isAmbiguousDate("03/04/2025")).toBe(true);
    expect(isAmbiguousDate("05/05/2025")).toBe(false);
    expect(isAmbiguousDate("14/03/2025")).toBe(false);
    expect(isAmbiguousDate("2025-03-04")).toBe(false);
  });

  it("detects the order a file's short dates follow", () => {
    expect(detectDateOrder(["03/04/2025", "25/04/2025", null])).toBe("dmy");
    expect(detectDateOrder(["03/04/2025", "04/25/2025"])).toBe("mdy");
    expect(detectDateOrder(["25/04/2025", "04/25/2025"])).toBe("mixed");
    expect(detectDateOrder(["03/04/2025", "2025-12-31", undefined])).toBeNull();
  });

  it("flags e-mail cells the API would refuse", () => {
    expect(isPlausibleEmail("contact@dupont-sarl.fr")).toBe(true);
    expect(isPlausibleEmail("a.b+c@mail.example.co.uk")).toBe(true);
    for (const bad of ["dupont", "dupont@", "dupont@local", "Jean <j@x.fr>", "a@b@c.fr", "x@.fr"]) {
      expect(isPlausibleEmail(bad)).toBe(false);
    }
  });

  it("recognises API date-times and trims text", () => {
    expect(isIsoDateTime("2025-03-14T10:12:00+01:00")).toBe(true);
    expect(isIsoDateTime("2025-03-14")).toBe(true);
    expect(isIsoDateTime("14/03/2025")).toBe(false);
    expect(cleanText("  x ")).toBe("x");
    expect(cleanText("   ")).toBeNull();
    expect(cleanText(42)).toBe("42");
  });
});

describe("callWithRateLimitRetry", () => {
  const sleep = vi.fn(() => Promise.resolve());

  it("pauses and retries while the answer is a rate limit", async () => {
    const call = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce("limited")
      .mockResolvedValueOnce("limited")
      .mockResolvedValueOnce("ok");
    const onPause = vi.fn();

    const result = await callWithRateLimitRetry(call, (r) => r === "limited", {
      sleep,
      onPause,
      pauseSeconds: 5,
    });

    expect(result).toBe("ok");
    expect(call).toHaveBeenCalledTimes(3);
    expect(onPause).toHaveBeenCalledWith(5);
    expect(sleep).toHaveBeenCalledWith(5000, undefined);
  });

  it("gives up after the last retry and when aborted during a pause", async () => {
    const call = vi.fn(() => Promise.resolve("limited"));
    expect(
      await callWithRateLimitRetry(call, (r) => r === "limited", { sleep, maxRetries: 2 })
    ).toBe("limited");
    expect(call).toHaveBeenCalledTimes(3);

    call.mockClear();
    const controller = new AbortController();
    const onResume = vi.fn();
    await callWithRateLimitRetry(call, (r) => r === "limited", {
      sleep: () => {
        controller.abort();
        return Promise.resolve();
      },
      signal: controller.signal,
      onResume,
    });
    expect(call).toHaveBeenCalledTimes(1);
    expect(onResume).not.toHaveBeenCalled();
  });

  it("lets a call that throws reach the caller", async () => {
    const call = vi.fn(() => Promise.reject(new Error("Failed to fetch")));
    await expect(callWithRateLimitRetry(call, () => false, { sleep })).rejects.toThrow(
      "Failed to fetch"
    );
  });
});

describe("abortableSleep", () => {
  it("ends as soon as the signal is aborted", async () => {
    vi.useFakeTimers();
    try {
      const controller = new AbortController();
      let done = false;
      const pause = abortableSleep(20_000, controller.signal).then(() => {
        done = true;
      });
      await vi.advanceTimersByTimeAsync(1_000);
      expect(done).toBe(false);
      controller.abort();
      await pause;
      expect(done).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("jsonByteLength", () => {
  it("counts UTF-8 bytes, not characters", () => {
    expect(jsonByteLength("é")).toBe(4); // two quotes + two bytes
    expect(MAX_ACTION_PAYLOAD_BYTES).toBeLessThan(1024 * 1024);
  });
});

describe("readImportFileText", () => {
  it("reads UTF-8 and falls back to Windows-1252 for legacy Excel CSV", async () => {
    const utf8 = new Blob([new TextEncoder().encode("Société")]);
    expect(await readImportFileText(utf8)).toBe("Société");

    // "Société" in Windows-1252: é is the single byte 0xE9.
    const cp1252 = new Blob([new Uint8Array([0x53, 0x6f, 0x63, 0x69, 0xe9, 0x74, 0xe9])]);
    expect(await readImportFileText(cp1252)).toBe("Société");
  });
});
