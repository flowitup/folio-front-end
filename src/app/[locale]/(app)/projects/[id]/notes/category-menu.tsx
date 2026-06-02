"use client";

/**
 * CategoryMenu — pill button that opens a popover for picking a note category.
 * Ports the artifact's CatMenu component.
 * Uses useClickOutside to close on outside click or Escape.
 */

import { useRef, useState, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { NOTE_CATEGORIES, CATEGORY_MAP } from "@/lib/notes/categories";
import type { NoteCategory } from "@/lib/api/notes";

interface CategoryMenuProps {
  value: NoteCategory;
  onChange: (cat: NoteCategory) => void;
  disabled?: boolean;
}

function useClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  onClose: () => void,
  active: boolean
) {
  useEffect(() => {
    if (!active) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [active, onClose, ref]);
}

export function CategoryMenu({ value, onChange, disabled = false }: CategoryMenuProps) {
  const t = useTranslations("notes");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  const close = () => setOpen(false);
  useClickOutside(ref, close, open);

  const cat = CATEGORY_MAP[value] ?? CATEGORY_MAP.general;
  const isSet = value !== "general";

  return (
    <span ref={ref} style={{ position: "relative" }}>
      <button
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

      {open && (
        <div className="pop" role="listbox" aria-label={t("categoryLabel")}>
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
      )}
    </span>
  );
}
