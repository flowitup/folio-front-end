/**
 * uploadAttachment — an expense attachment uploaded after the access token
 * expired refreshes the session and retries once, with the CSRF token the
 * refresh rotated in and a fresh multipart body.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/config/env", () => ({
  env: { apiBaseUrl: "http://api.test/api/v1" },
}));

import { uploadAttachment } from "../invoice-api";
import { ApiError } from "../http";

const UPLOAD_URL = "http://api.test/api/v1/projects/p1/invoices/i1/attachments";

function setCsrfCookie(value: string) {
  document.cookie = `csrf_access_token=${encodeURIComponent(value)}; path=/`;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function makeFile(): File {
  return new File([new Uint8Array(16)], "receipt.pdf", { type: "application/pdf" });
}

beforeEach(() => {
  setCsrfCookie("csrf-old");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("uploadAttachment — expired access token", () => {
  it("refreshes, then retries with the rotated CSRF token and a new body", async () => {
    const attachment = { id: "a1", filename: "receipt.pdf" };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(401, { msg: "Token has expired" }))
      .mockImplementationOnce(async () => {
        // POST /auth/refresh rotates csrf_access_token.
        setCsrfCookie("csrf-new");
        return json(200, {});
      })
      .mockResolvedValueOnce(json(201, attachment));
    vi.stubGlobal("fetch", fetchMock);

    const file = makeFile();
    const out = await uploadAttachment("p1", "i1", file);

    expect(out).toEqual(attachment);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/auth\/refresh$/);

    const [firstUrl, first] = fetchMock.mock.calls[0] as [string, RequestInit];
    const [retryUrl, retry] = fetchMock.mock.calls[2] as [string, RequestInit];
    expect(firstUrl).toBe(UPLOAD_URL);
    expect(retryUrl).toBe(UPLOAD_URL);
    expect(first.headers).toMatchObject({ "X-CSRF-TOKEN": "csrf-old" });
    expect(retry.headers).toMatchObject({ "X-CSRF-TOKEN": "csrf-new" });
    expect(retry.credentials).toBe("include");
    expect(retry.body).toBeInstanceOf(FormData);
    expect(retry.body).not.toBe(first.body);
    expect((retry.body as FormData).get("file")).toBe(file);
  });

  it("throws the 401 when the refresh fails, without retrying", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(401, { msg: "Token has expired" }))
      .mockResolvedValueOnce(json(401, { msg: "Refresh expired" }));
    vi.stubGlobal("fetch", fetchMock);

    const error = await uploadAttachment("p1", "i1", makeFile()).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not refresh on other errors", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json(413, { error: "file_too_large" }));
    vi.stubGlobal("fetch", fetchMock);

    const error = await uploadAttachment("p1", "i1", makeFile()).catch((e: unknown) => e);

    expect((error as ApiError).status).toBe(413);
    expect((error as ApiError).data).toEqual({ error: "file_too_large" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
