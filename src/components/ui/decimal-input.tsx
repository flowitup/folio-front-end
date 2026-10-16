"use client";

/**
 * A text box for a decimal figure (quantity, unit price, VAT rate) that reads
 * "18,5" and "18.5" alike in every browser language.
 *
 * <input type="number"> follows the browser's language, not the app's: in an
 * English-language browser "18,5" became 185 and "45,90" 4 590. This keeps
 * what the user typed on screen and hands the parent a canonical "18.5"
 * (through parseMoneyInput); text that is not a number yet ("18,") is passed
 * through unchanged so the form's own check refuses it.
 */

import { useState, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { parseMoneyInput } from "@/lib/utils/parse-money-input";

type DecimalInputProps = Omit<ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  value: string;
  onChange: (value: string) => void;
  /** Most decimals accepted (quantity 3, unit price 4, VAT rate 2). */
  maxDecimals?: number;
};

/** "18,5" -> "18.5"; anything unreadable is returned as typed. */
export function canonicalDecimal(raw: string, maxDecimals: number): string {
  const n = parseMoneyInput(raw, { maxDecimals });
  return n === null ? raw : String(n);
}

export function DecimalInput({ value, onChange, maxDecimals = 2, ...rest }: DecimalInputProps) {
  const [draft, setDraft] = useState(value);
  // The value this field last sent up (or was given): when the parent sets
  // another one (a template fills the line), show that instead of the draft.
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    setDraft(value);
  }

  return (
    <Input
      {...rest}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={draft}
      onChange={(e) => {
        const raw = e.target.value;
        const next = canonicalDecimal(raw, maxDecimals);
        setDraft(raw);
        setSynced(next);
        onChange(next);
      }}
    />
  );
}
