"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Lightweight delegated hover tooltip for dataviz marks.
 *
 * Any descendant carrying `data-tip="label|value|meta"` shows a fixed-position
 * tooltip anchored to the mark's top-center while the pointer is over it, or
 * while it has keyboard focus. Spread `tipHandlers` on the container (or attach
 * `onMouseMove`/`onMouseLeave`/`onFocus`/`onBlur`) and render `overlay` once at
 * the root.
 *
 * On a phone a tap shows the tip; it goes away on scroll or a tap elsewhere
 * instead of staying stuck over the page, and it is kept inside the viewport
 * (a mark at the left edge used to cut its tip in half).
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
/** Half the tip's max width plus a margin: its center never comes closer to an edge. */
const TIP_MAX_W = 240;
const EDGE_PX = TIP_MAX_W / 2 + 8;

function tipFor(target: EventTarget | null): DataTipState | null {
  const el = target instanceof Element ? target.closest<HTMLElement>("[data-tip]") : null;
  if (!el) return null;
  const [label = "", value = "", meta = ""] = (el.dataset.tip ?? "").split("|");
  const r = el.getBoundingClientRect();
  const placement = r.top < FLIP_HEADROOM_PX ? "below" : "above";
  const center = r.left + r.width / 2;
  const viewportW = typeof window !== "undefined" ? window.innerWidth : 0;
  const x = viewportW > 2 * EDGE_PX ? Math.min(Math.max(center, EDGE_PX), viewportW - EDGE_PX) : center;
  return { label, value, meta, x, y: placement === "above" ? r.top : r.bottom, placement };
}

export function useDataTip() {
  const [tip, setTip] = useState<DataTipState | null>(null);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const next = tipFor(e.target);
    setTip((prev) => (next ? next : prev ? null : prev));
  }, []);

  const onMouseLeave = useCallback(() => setTip(null), []);

  // Keyboard: a focusable mark shows its tip while focused.
  const onFocus = useCallback((e: React.FocusEvent) => setTip(tipFor(e.target)), []);
  const onBlur = useCallback(() => setTip(null), []);

  // A tapped tip has no mouseleave to close it: scrolling or tapping
  // anywhere else does.
  const isOpen = tip !== null;
  useEffect(() => {
    if (!isOpen) return;
    const close = () => setTip(null);
    const closeOutside = (e: PointerEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest("[data-tip]")) close();
    };
    window.addEventListener("scroll", close, { capture: true, passive: true });
    window.addEventListener("resize", close);
    document.addEventListener("pointerdown", closeOutside);
    return () => {
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("resize", close);
      document.removeEventListener("pointerdown", closeOutside);
    };
  }, [isOpen]);

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
            maxWidth: TIP_MAX_W,
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

  return {
    onMouseMove,
    onMouseLeave,
    onFocus,
    onBlur,
    /** All four handlers, to spread on the container. */
    tipHandlers: { onMouseMove, onMouseLeave, onFocus, onBlur },
    overlay,
  };
}
