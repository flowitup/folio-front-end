"use client";

import { useCallback, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Lightweight delegated hover tooltip for dataviz marks.
 *
 * Any descendant carrying `data-tip="label|value|meta"` shows a fixed-position
 * tooltip anchored to the mark's top-center while the pointer is over it.
 * Attach `onMouseMove`/`onMouseLeave` to the container and render `overlay`
 * once at the root. Hover-only by design — every mark also carries a visible
 * text label + amount, so touch/keyboard users lose nothing.
 *
 * The overlay portals to `document.body`, outside the app shell's `zoom`-ed
 * content wrapper: a `position: fixed` element inside a zoomed subtree gets
 * its px offsets rescaled by the browser, drifting the tip away from the mark
 * it anchors to. On the body, viewport-space rect coords apply verbatim.
 */
interface DataTipState {
  label: string;
  value: string;
  meta: string;
  x: number;
  /** Anchor y in viewport px: mark top when placed above, mark bottom when below. */
  y: number;
  /** Placement flips to "below" when the mark is too close to the viewport top
   * for the tip to fit above — a fixed-position tip at negative y is invisible. */
  placement: "above" | "below";
}

/** Tallest tip (3 rows) + breathing room; above this from the viewport top the
 * tip fits in its default above-the-mark spot. */
const FLIP_HEADROOM_PX = 88;

export function useDataTip() {
  const [tip, setTip] = useState<DataTipState | null>(null);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-tip]");
    if (!el) {
      setTip((prev) => (prev ? null : prev));
      return;
    }
    const [label = "", value = "", meta = ""] = (el.dataset.tip ?? "").split("|");
    const r = el.getBoundingClientRect();
    const placement = r.top < FLIP_HEADROOM_PX ? "below" : "above";
    setTip({
      label,
      value,
      meta,
      x: r.left + r.width / 2,
      y: placement === "above" ? r.top : r.bottom,
      placement,
    });
  }, []);

  const onMouseLeave = useCallback(() => setTip(null), []);

  // `tip` is only ever set from a mouse event, so `document` exists here.
  const overlay = tip
    ? createPortal(
        <div
          role="presentation"
          className="fixed z-50"
          style={{
            left: tip.x,
            top: tip.y,
            transform:
              tip.placement === "above"
                ? "translate(-50%, -130%)"
                : "translate(-50%, 10px)",
            pointerEvents: "none",
            background: "var(--ink)",
            color: "var(--paper)",
            borderRadius: 8,
            padding: "7px 10px",
            boxShadow: "0 8px 24px -10px rgba(0,0,0,.45)",
          }}
        >
          <div className="label-cap" style={{ color: "var(--paper)", opacity: 0.62 }}>
            {tip.label}
          </div>
          <div className="num mt-0.5 text-[14px] font-medium">{tip.value}</div>
          {tip.meta && (
            <div className="num text-[10.5px]" style={{ opacity: 0.62 }}>
              {tip.meta}
            </div>
          )}
        </div>,
        document.body
      )
    : null;

  return { onMouseMove, onMouseLeave, overlay };
}
