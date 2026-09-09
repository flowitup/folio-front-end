"use client";

/**
 * useChatFeature — whether this deployment enables team chat (`GET /features`).
 * Fetched once per browser session (module cache shared by every consumer); `null`
 * while unknown so callers hide chat until the backend confirms it.
 */

import { useEffect, useState } from "react";
import { fetchChatFeatures } from "@/lib/api/chat-client";

let cached: Promise<boolean> | null = null;

function loadChatFeature(): Promise<boolean> {
  if (!cached) {
    cached = fetchChatFeatures()
      .then((features) => features.chat === true)
      .catch(() => {
        // Let the next mount retry instead of pinning "off" for the whole session.
        cached = null;
        return false;
      });
  }
  return cached;
}

/** Test hook: forget the cached flag. */
export function resetChatFeatureCache(): void {
  cached = null;
}

export function useChatFeature(): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    void loadChatFeature().then((value) => {
      if (!cancelled) setEnabled(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return enabled;
}
