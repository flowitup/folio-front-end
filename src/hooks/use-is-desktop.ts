"use client";

/**
 * useIsDesktop — true at and above Tailwind's `lg` breakpoint (1024 px). Starts false so the
 * server and first client render agree; updates on resize.
 */

import { useEffect, useState } from "react";

const QUERY = "(min-width: 1024px)";

export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(QUERY);
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return isDesktop;
}
