"use client";

import { useRef, useCallback } from "react";

export type DialogBounds = { x: number; y: number; w: number; h: number };

type Props = { onResize: (bounds: DialogBounds) => void };

const MIN_W = 400;
const MIN_H = 300;
const PAD = 16;

const HANDLES: { edge: string; cls: string }[] = [
  { edge: "t", cls: "top-0 left-4 right-4 h-2 cursor-ns-resize" },
  { edge: "b", cls: "bottom-0 left-4 right-4 h-2 cursor-ns-resize" },
  { edge: "l", cls: "top-4 left-0 bottom-4 w-2 cursor-ew-resize" },
  { edge: "r", cls: "top-4 right-0 bottom-4 w-2 cursor-ew-resize" },
  { edge: "tl", cls: "top-0 left-0 w-4 h-4 cursor-nwse-resize" },
  { edge: "tr", cls: "top-0 right-0 w-4 h-4 cursor-nesw-resize" },
  { edge: "bl", cls: "bottom-0 left-0 w-4 h-4 cursor-nesw-resize" },
  { edge: "br", cls: "bottom-0 right-0 w-4 h-4 cursor-nwse-resize" },
];

export function ResizableDialogHandles({ onResize }: Props) {
  const dragRef = useRef<{
    edge: string;
    sx: number;
    sy: number;
    sb: DialogBounds;
  } | null>(null);

  const onDown = useCallback(
    (e: React.PointerEvent, edge: string) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      const el = (e.target as HTMLElement).closest(
        '[data-slot="dialog-content"]',
      );
      if (!el) return;
      const r = el.getBoundingClientRect();
      dragRef.current = {
        edge,
        sx: e.clientX,
        sy: e.clientY,
        sb: { x: r.left, y: r.top, w: r.width, h: r.height },
      };
    },
    [],
  );

  const onMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.sx;
      const dy = e.clientY - d.sy;
      let { x, y, w, h } = d.sb;

      if (d.edge.includes("l")) { x += dx; w -= dx; }
      if (d.edge.includes("r")) w += dx;
      if (d.edge.includes("t")) { y += dy; h -= dy; }
      if (d.edge.includes("b")) h += dy;

      if (w < MIN_W) { if (d.edge.includes("l")) x -= MIN_W - w; w = MIN_W; }
      if (h < MIN_H) { if (d.edge.includes("t")) y -= MIN_H - h; h = MIN_H; }

      x = Math.max(PAD, x);
      y = Math.max(PAD, y);
      if (x + w > window.innerWidth - PAD) w = window.innerWidth - PAD - x;
      if (y + h > window.innerHeight - PAD) h = window.innerHeight - PAD - y;

      onResize({ x, y, w, h });
    },
    [onResize],
  );

  const onUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  return (
    <>
      {HANDLES.map(({ edge, cls }) => (
        <div
          key={edge}
          className={`absolute touch-none ${cls}`}
          onPointerDown={(e) => onDown(e, edge)}
          onPointerMove={onMove}
          onPointerUp={onUp}
        />
      ))}
    </>
  );
}
