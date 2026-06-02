"use client";

/**
 * QuickAdd — capture box for new notes.
 * Title always visible; body + category slide in on focus.
 * Enter on title = submit; Cmd/Ctrl+Enter from body = submit; Esc = collapse.
 * Ports the artifact's QuickAdd component.
 */

import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { CategoryMenu } from "./category-menu";
import type { NoteCategory } from "@/lib/api/notes";

export interface QuickAddPayload {
  title: string;
  description: string | null;
  category: NoteCategory;
}

interface QuickAddProps {
  onAdd: (payload: QuickAddPayload) => void;
  disabled?: boolean;
}

export function QuickAdd({ onAdd, disabled = false }: QuickAddProps) {
  const t = useTranslations("notes");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [cat, setCat] = useState<NoteCategory>("general");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const open = focused || title.trim().length > 0 || body.trim().length > 0;

  function reset() {
    setTitle("");
    setBody("");
    setCat("general");
  }

  function submit() {
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd({ title: trimmed, description: body.trim() || null, category: cat });
    reset();
    inputRef.current?.focus();
  }

  function onTitleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); submit(); }
    if (e.key === "Escape") { (e.target as HTMLElement).blur(); reset(); setFocused(false); }
  }

  function onBodyKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); }
    if (e.key === "Escape") { (e.target as HTMLElement).blur(); setFocused(false); }
  }

  function onBlurCapture() {
    requestAnimationFrame(() => {
      if (
        wrapRef.current &&
        !wrapRef.current.contains(document.activeElement) &&
        !title.trim() &&
        !body.trim()
      ) {
        setFocused(false);
      }
    });
  }

  return (
    <div
      ref={wrapRef}
      className={"quickadd" + (open ? " focused" : "")}
      onBlurCapture={onBlurCapture}
    >
      <div className="quickadd-top">
        <span className="quickadd-plus">
          <Plus size={18} />
        </span>
        <input
          ref={inputRef}
          className="quickadd-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={onTitleKey}
          placeholder={t("quickAdd.placeholderTitle")}
          aria-label={t("quickAdd.placeholderTitle")}
          disabled={disabled}
        />
        {!open && (
          <span className="quickadd-hint">{t("quickAdd.hint")}</span>
        )}
      </div>

      <div className="quickadd-meta">
        <div className="quickadd-meta-inner">
          <div className="quickadd-body-wrap">
            <textarea
              className="quickadd-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={onBodyKey}
              placeholder={t("quickAdd.placeholderBody")}
              aria-label={t("quickAdd.placeholderBody")}
              rows={3}
              disabled={disabled}
            />
            <div className="quickadd-controls">
              <CategoryMenu value={cat} onChange={setCat} disabled={disabled} />
              <button
                type="button"
                className="btn btn-primary"
                style={{ marginLeft: "auto", padding: "8px 16px" }}
                onClick={submit}
                disabled={disabled || !title.trim()}
              >
                {t("quickAdd.save")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
