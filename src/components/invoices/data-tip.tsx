"use client";

import { useCallback, useState } from "react";

/**
 * Lightweight delegated hover tooltip for dataviz marks.
 *
 * Any descendant carrying `data-tip="label|value|meta"` shows a fixed-position
 * tooltip anchored to the mark's top-center while the pointer is over it.
 * Attach `onMouseMove`/`onMouseLeave` to the container and render `overlay`
 * once at the root. Hover-only by design — every mark also carries a visible
 * text label + amount, so touch/keyboard users lose nothing.
 */
interface DataTipState {
  label: string;
  value: string;
  meta: string;
  x: number;
  y: number;
}

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
    setTip({ label, value, meta, x: r.left + r.width / 2, y: r.top });
  }, []);

  const onMouseLeave = useCallback(() => setTip(null), []);

  const overlay = tip ? (
    <div
      role="presentation"
      className="fixed z-50"
      style={{
        left: tip.x,
        top: tip.y,
        transform: "translate(-50%, -130%)",
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
    </div>
  ) : null;

  return { onMouseMove, onMouseLeave, overlay };
}
