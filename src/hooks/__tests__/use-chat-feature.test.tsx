/**
 * useChatFeature reads the cached `GET /features` fetch — `null` until it lands.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchChatFeatures = vi.fn();
vi.mock("@/lib/api/chat-client", () => ({
  fetchChatFeatures: (...args: unknown[]) => fetchChatFeatures(...args),
}));

import { resetChatFeatureCache, useChatFeature } from "@/hooks/use-chat-feature";

beforeEach(() => {
  fetchChatFeatures.mockReset();
  resetChatFeatureCache();
});

afterEach(() => {
  resetChatFeatureCache();
});

describe("useChatFeature", () => {
  it("reads the flag off the response, starting null until it resolves", async () => {
    fetchChatFeatures.mockResolvedValue({ chat: true });
    const chat = renderHook(() => useChatFeature());
    expect(chat.result.current).toBeNull();
    await waitFor(() => expect(chat.result.current).toBe(true));
  });

  it("fetches /features only once for several consumers (shared cache)", async () => {
    fetchChatFeatures.mockResolvedValue({ chat: true });
    const a = renderHook(() => useChatFeature());
    const b = renderHook(() => useChatFeature());
    await waitFor(() => expect(a.result.current).toBe(true));
    await waitFor(() => expect(b.result.current).toBe(true));
    expect(fetchChatFeatures).toHaveBeenCalledTimes(1);
  });

  it("falls back to off and lets the next mount retry after a fetch failure", async () => {
    fetchChatFeatures.mockRejectedValueOnce(new Error("network"));
    const first = renderHook(() => useChatFeature());
    await waitFor(() => expect(first.result.current).toBe(false));

    fetchChatFeatures.mockResolvedValueOnce({ chat: true });
    let second: ReturnType<typeof renderHook<boolean | null, unknown>>;
    act(() => {
      second = renderHook(() => useChatFeature());
    });
    await waitFor(() => expect(second!.result.current).toBe(true));
    expect(fetchChatFeatures).toHaveBeenCalledTimes(2);
  });
});
