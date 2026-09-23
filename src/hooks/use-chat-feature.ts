"use client";

/**
 * useChatFeature / useAssistantFeature — deployment feature flags from `GET /features`
 * (`{ chat, assistant }`). Fetched once per browser session (module cache shared by every
 * consumer, both flags come off the same response); `null` while unknown so callers hide
 * chat/assistant UI until the backend confirms it.
 */

import { useEffect, useState } from "react";
import { fetchChatFeatures, type ChatFeatures } from "@/lib/api/chat-client";

let cached: Promise<ChatFeatures> | null = null;

function loadFeatures(): Promise<ChatFeatures> {
  if (!cached) {
    cached = fetchChatFeatures().catch(() => {
      // Let the next mount retry instead of pinning "off" for the whole session.
      cached = null;
      return { chat: false, assistant: false };
    });
  }
  return cached;
}

/** Test hook: forget the cached flags. */
export function resetChatFeatureCache(): void {
  cached = null;
}

export function useChatFeature(): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    void loadFeatures().then((features) => {
      if (!cancelled) setEnabled(features.chat === true);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return enabled;
}

/** `true` once the backend has confirmed the assistant feature; `false` while unknown or
 * off. Gates the web choice-message buttons — with this off (or unknown), the backend would
 * answer a tapped option with 404 `FeatureDisabled`, so the buttons stay hidden instead of
 * dead-ending there. */
export function useAssistantFeature(): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    void loadFeatures().then((features) => {
      if (!cancelled) setEnabled(features.assistant === true);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return enabled;
}
