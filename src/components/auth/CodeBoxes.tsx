"use client";

import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from "react";

export const CODE_LENGTH = 6;

type CodeBoxesState = "idle" | "error" | "verified";

interface CodeBoxesProps {
  value: string;
  onChange: (value: string) => void;
  /** Called once, on the edit that completes all six digits — drives auto-submit. */
  onComplete?: (value: string) => void;
  state?: CodeBoxesState;
  disabled?: boolean;
  /** Labels the group for screen readers; each box announces its position. */
  label: string;
  positionLabel: (position: number) => string;
}

/**
 * Only error and success repaint the border; the idle border and the focus
 * ring both come from `.folio-input`, so a focused box always reads as focused
 * even while the row is showing an error.
 */
function borderColorFor(state: CodeBoxesState): string | undefined {
  if (state === "error") return "var(--negative)";
  if (state === "verified") return "var(--positive)";
  return undefined;
}

/**
 * The 6-digit SMS code as one box per digit. The value stays a plain compact
 * string of digits — typing writes at the box you are on (or appends, so the
 * row can never hold a gap), Backspace drops the last digit, and pasting a
 * texted code fills the whole row from wherever you paste.
 */
export function CodeBoxes({
  value,
  onChange,
  onComplete,
  state = "idle",
  disabled,
  label,
  positionLabel,
}: CodeBoxesProps) {
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(CODE_LENGTH, " ").slice(0, CODE_LENGTH).split("");

  // Someone typing quickly can land two keystrokes in one React batch, and the
  // second would then read `value` from the render before the first — losing a
  // digit. This ref is the authoritative code between renders.
  const typed = useRef(value);
  useEffect(() => {
    typed.current = value;
  }, [value]);

  const focusBox = (index: number) => {
    boxes.current[Math.min(Math.max(index, 0), CODE_LENGTH - 1)]?.focus();
  };

  const commit = (next: string) => {
    typed.current = next;
    onChange(next);
    if (next.length === CODE_LENGTH) onComplete?.(next);
  };

  /** Write `text`'s digits from `start`, clamped so the code never gets a hole. */
  const writeAt = (start: number, text: string) => {
    const incoming = text.replace(/\D/g, "");
    if (!incoming) return;
    const chars = typed.current.split("");
    let cursor = Math.min(start, chars.length);
    for (const char of incoming) {
      if (cursor >= CODE_LENGTH) break;
      chars[cursor] = char;
      cursor += 1;
    }
    commit(chars.join("").slice(0, CODE_LENGTH));
    focusBox(cursor);
  };

  const handleKeyDown = (index: number) => (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace") {
      // Typing always advances, so the last digit is the one the user means to
      // take back; dropping it keeps the row gap-free and steps focus back.
      event.preventDefault();
      if (!typed.current) return;
      const next = typed.current.slice(0, -1);
      typed.current = next;
      onChange(next);
      focusBox(next.length);
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusBox(index - 1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusBox(index + 1);
    }
  };

  const handlePaste = (index: number) => (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    writeAt(index, event.clipboardData.getData("text"));
  };

  return (
    <div className="mt-0.5 flex gap-2" role="group" aria-label={label}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            boxes.current[index] = element;
          }}
          data-testid={`login-code-${index}`}
          aria-label={positionLabel(index + 1)}
          type="text"
          inputMode="numeric"
          // Only the first box claims the OTP hint: browsers that autofill a
          // whole code write it there, and writeAt spreads it across the row.
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={1}
          disabled={disabled}
          value={digit === " " ? "" : digit}
          onChange={(event) => writeAt(index, event.target.value)}
          onKeyDown={handleKeyDown(index)}
          onPaste={handlePaste(index)}
          onFocus={(event) => event.target.select()}
          className="folio-input num h-14 min-w-0 flex-1 p-0 text-center text-[22px] font-medium disabled:opacity-60"
          style={{
            borderColor: borderColorFor(state),
            opacity: state === "verified" ? 0.7 : undefined,
          }}
        />
      ))}
    </div>
  );
}
