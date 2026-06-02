"use client";

/**
 * CategoryMenu — pill button that opens a portaled popover for picking a note category.
 * Renders the .pop dropdown via createPortal to document.body (position:fixed) so it
 * escapes CSS multi-column containing blocks without clipping or overflow.
 */

import { useRef, useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { NOTE_CATEGORIES, CATEGORY_MAP } from "@/lib/notes/categories";
import type { NoteCategory } from "@/lib/api/notes";

interface CategoryMenuProps {
  value: NoteCategory;
  onChange: (cat: NoteCategory) => void;
  disabled?: boolean;
}

interface PopoverPos {
  top: number;
  left: number;
}

function computePos(triggerEl: HTMLElement): PopoverPos {
  const rect = triggerEl.getBoundingClientRect();
  return { top: rect.bottom + 6, left: rect.left };
}

export function CategoryMenu({ value, onChange, disabled = false }: CategoryMenuProps) {
  const t = useTranslations("notes");
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<PopoverPos>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  // Recompute popover position on open and track scroll/resize while open
  useEffect(() => {
    if (!open || !triggerRef.current) return;
    setPos(computePos(triggerRef.current));

    function reposition() {
      if (triggerRef.current) setPos(computePos(triggerRef.current));
    }
    function onScroll() {
      // Close on scroll — simpler and avoids stale positioning in nested scrollers
      close();
    }

    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", onScroll, { capture: true });
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, [open, close]);

  // Close on outside click (checks both trigger AND portaled pop)
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const target = e.target as Node;
      const insideTrigger = triggerRef.current?.contains(target) ?? false;
      const insidePop = popRef.current?.contains(target) ?? false;
      if (!insideTrigger && !insidePop) close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const cat = CATEGORY_MAP[value] ?? CATEGORY_MAP.general;
  const isSet = value !== "general";

  const popover = open ? (
    <div
      ref={popRef}
      className="pop"
      role="listbox"
      aria-label={t("categoryLabel")}
      style={{ position: "fixed", top: pos.top, left: pos.left }}
    >
      <div className="pop-label">{t("categoryLabel")}</div>
      {NOTE_CATEGORIES.map((c) => (
        <button
          key={c.id}
          type="button"
          role="option"
          aria-selected={value === c.id}
          className={"pop-item" + (value === c.id ? " sel" : "")}
          onClick={() => { onChange(c.id); setOpen(false); }}
        >
          <span className="cat-dot" style={{ background: c.dotColor }} />
          <span>{t(`categories.${c.id}`)}</span>
          {value === c.id && (
            <Check size={15} style={{ marginLeft: "auto", color: "var(--accent)" }} />
          )}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={"pill" + (isSet ? " set" : "")}
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="cat-dot" style={{ background: cat.dotColor }} />
        <span>{t(`categories.${cat.id}`)}</span>
        <ChevronDown size={13} style={{ color: "var(--muted)" }} />
      </button>

      {typeof window !== "undefined" && createPortal(popover, document.body)}
    </>
  );
}
