/**
 * chat-client: browser-direct transport. Pins the JSON vs multipart send shapes, the
 * CSRF header on mutations, cookie credentials, and the single 401 → refresh → retry.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockRefresh = vi.fn();
vi.mock("@/lib/api/refresh", () => ({
  refreshAccessTokenViaCookie: () => mockRefresh(),
}));

vi.mock("@/lib/config/env", () => ({
  env: { apiBaseUrl: "http://api.test/api/v1" },
}));

import {
  ChatApiError,
  fetchChatAttachmentBlob,
  fetchChatFeatures,
  listChatChannels,
  listChatMessages,
  markChatChannelRead,
  sendChatMessage,
} from "@/lib/api/chat-client";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  document.cookie = "csrf_access_token=csrf-123";
  mockRefresh.mockReset();
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("chat-client", () => {
  it("reads the feature flag with cookie credentials", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ chat: true }));
    await expect(fetchChatFeatures()).resolves.toEqual({ chat: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/api/v1/features");
    expect(init?.credentials).toBe("include");
    expect(init?.method).toBe("GET");
  });

  it("unwraps channel items and encodes the channel key in message URLs", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ items: [{ key: "company:1", unread_count: 2 }] }))
      .mockResolvedValueOnce(jsonResponse({ items: [], members: [] }));
    const channels = await listChatChannels();
    expect(channels).toEqual([{ key: "company:1", unread_count: 2 }]);
    await listChatMessages("project:ab/cd", { limit: 25 });
    expect(fetchMock.mock.calls[1][0]).toBe(
      "http://api.test/api/v1/chat/channels/project%3Aab%2Fcd/messages?limit=25"
    );
  });

  it("sends a text-only message as JSON with the CSRF header", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: "m1" }, 201));
    await sendChatMessage("company:1", { body: "  hello  " });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/api/v1/chat/channels/company%3A1/messages");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({ body: "hello" }));
    const headers = init?.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["X-CSRF-TOKEN"]).toBe("csrf-123");
  });

  it("sends an image as multipart without a JSON content type", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: "m2" }, 201));
    const file = new File(["png-bytes"], "site.png", { type: "image/png" });
    await sendChatMessage("project:9", { body: "look", file });
    const init = fetchMock.mock.calls[0][1];
    expect(init?.body).toBeInstanceOf(FormData);
    const form = init?.body as FormData;
    expect((form.get("file") as File).name).toBe("site.png");
    expect(form.get("body")).toBe("look");
    const headers = init?.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBeUndefined();
    expect(headers["X-CSRF-TOKEN"]).toBe("csrf-123");
  });

  it("retries once after a 401 when the refresh succeeds", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    mockRefresh.mockResolvedValueOnce(true);
    await expect(markChatChannelRead("company:1")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it("builds attachment blobs only with allowlisted image types", async () => {
    const urls: string[] = [];
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: (blob: Blob) => {
        urls.push(blob.type);
        return `blob:${blob.type}`;
      },
      revokeObjectURL: vi.fn(),
    });
    fetchMock
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "Content-Type": "image/png" } }))
      .mockResolvedValueOnce(new Response("<script>", { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }));
    await fetchChatAttachmentBlob("m1");
    await fetchChatAttachmentBlob("m2");
    expect(urls).toEqual(["image/png", "application/octet-stream"]);
  });

  it("throws a ChatApiError carrying status and body on failure", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: "UnsupportedMediaType", message: "nope" }, 415)
    );
    mockRefresh.mockResolvedValue(false);
    await expect(sendChatMessage("company:1", { body: "x" })).rejects.toMatchObject({
      name: "ChatApiError",
      status: 415,
      body: { error: "UnsupportedMediaType" },
    });
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "Forbidden" }, 403));
    await expect(
      sendChatMessage("company:1", { body: "x" }).catch((e) => e instanceof ChatApiError)
    ).resolves.toBe(true);
  });
});
