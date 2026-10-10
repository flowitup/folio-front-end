"use client";

/**
 * useChatFeature — deployment feature flag from `GET /features` (`{ chat }`). Fetched once
 * per browser session (module cache shared by every consumer); `null` while unknown so
 * callers hide chat UI until the backend confirms it.
 */

import { useEffect, useState } from "react";
import { fetchChatFeatures, type ChatFeatures } from "@/lib/api/chat-client";

let cached: Promise<ChatFeatures> | null = null;

function loadFeatures(): Promise<ChatFeatures> {
  if (!cached) {
    cached = fetchChatFeatures().catch(() => {
      // Let the next mount retry instead of pinning "off" for the whole session.
      cached = null;
      return { chat: false };
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
