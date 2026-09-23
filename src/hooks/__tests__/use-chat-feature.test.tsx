/**
 * useChatFeature / useAssistantFeature share one cached `GET /features` fetch (both flags
 * come off the same response) — each hook reads its own boolean, `null` until it lands.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchChatFeatures = vi.fn();
vi.mock("@/lib/api/chat-client", () => ({
  fetchChatFeatures: (...args: unknown[]) => fetchChatFeatures(...args),
}));

import { resetChatFeatureCache, useAssistantFeature, useChatFeature } from "@/hooks/use-chat-feature";

beforeEach(() => {
  fetchChatFeatures.mockReset();
  resetChatFeatureCache();
});

afterEach(() => {
  resetChatFeatureCache();
});

describe("useChatFeature / useAssistantFeature", () => {
  it("reads its own flag off the shared response, starting null until it resolves", async () => {
    fetchChatFeatures.mockResolvedValue({ chat: true, assistant: false });
    const chat = renderHook(() => useChatFeature());
    const assistant = renderHook(() => useAssistantFeature());
    expect(chat.result.current).toBeNull();
    expect(assistant.result.current).toBeNull();
    await waitFor(() => expect(chat.result.current).toBe(true));
    await waitFor(() => expect(assistant.result.current).toBe(false));
  });

  it("fetches /features only once for both hooks (shared cache)", async () => {
    fetchChatFeatures.mockResolvedValue({ chat: true, assistant: true });
    const chat = renderHook(() => useChatFeature());
    const assistant = renderHook(() => useAssistantFeature());
    await waitFor(() => expect(chat.result.current).toBe(true));
    await waitFor(() => expect(assistant.result.current).toBe(true));
    expect(fetchChatFeatures).toHaveBeenCalledTimes(1);
  });

  it("falls back to both flags off and lets the next mount retry after a fetch failure", async () => {
    fetchChatFeatures.mockRejectedValueOnce(new Error("network"));
    const first = renderHook(() => useChatFeature());
    await waitFor(() => expect(first.result.current).toBe(false));

    fetchChatFeatures.mockResolvedValueOnce({ chat: true, assistant: true });
    let second: ReturnType<typeof renderHook<boolean | null, unknown>>;
    act(() => {
      second = renderHook(() => useChatFeature());
    });
    await waitFor(() => expect(second!.result.current).toBe(true));
    expect(fetchChatFeatures).toHaveBeenCalledTimes(2);
  });
});
