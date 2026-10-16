"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

/**
 * Props that make a chart mark (an SVG rect, a bar <div>, a dial) open the
 * list it adds up: a pointer cursor, a click, and the keyboard (it is
 * focusable, Enter or Space opens it, and focus shows its data-tip). Spread the
 * result on the mark; with no `href` it stays a plain mark.
 *
 * Marks inside an SVG cannot hold a Next <Link>, hence router.push.
 */
function useOptionalRouter() {
  try {
    return useRouter();
  } catch {
    // Rendered outside the app router (an isolated test): plain navigation.
    return null;
  }
}

export function useChartLink({ scroll = true }: { scroll?: boolean } = {}) {
  const router = useOptionalRouter();
  return useCallback(
    (href: string | null | undefined, label: string) => {
      if (!href) return {};
      // `scroll: false` for a filter of the page the chart is on (the Expense
      // page's summary): the list under it changes, the page stays put.
      const open = () => (router ? router.push(href, { scroll }) : window.location.assign(href));
      return {
        role: "link" as const,
        tabIndex: 0,
        "aria-label": label,
        // Styled by globals.css (pointer, hover, focus ring) and read by tests.
        "data-href": href,
        onClick: open,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open();
          }
        },
      };
    },
    [router, scroll]
  );
}
