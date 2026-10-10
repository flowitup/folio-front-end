"use client";

/**
 * useHydrated — false while React hydrates the server HTML, true afterwards and on any
 * client-only mount. Gate text that depends on the viewer's time zone with it: the server
 * renders in its own zone, and a different text in the browser is a hydration error.
 */

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

export function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
