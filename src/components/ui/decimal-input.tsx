"use client";

/**
 * DecimalInput — a number field that accepts the user's decimal mark.
 *
 * `<input type="number">` follows the BROWSER's language, not the app's: in an
 * English Chrome, a French user typing "2,5" gets 25 (the comma is dropped),
 * and "18,90" becomes 1890 — a 100× amount on a quote with no warning.
 *
 * This field is a text input with a decimal keypad. It shows the value with
 * the locale's decimal mark ("2,5" in fr/vi), reads what the user types with
 * parseMoneyInput (',' or '.'), and hands the parent a canonical dot string
 * ("2.5") — the Decimal-as-string the API expects. While the text cannot be
 * read as a number, the parent receives the raw text instead, so its own
 * validation refuses the save, and the field is marked invalid.
 */

import * as React from "react";
import { useLocale } from "next-intl";
import { Input } from "@/components/ui/input";
import {
  formatMoneyInput,
  parseMoneyInput,
  type ParseMoneyInputOptions,
} from "@/lib/utils/parse-money-input";

/**
 * "2.5" → "2,5" in fr/vi, through the shared money-input formatter (no grouping,
 * the API's trailing zeros dropped: "18.9000" → "18,9"); other values (empty,
 * invalid text) pass through.
 */
export function formatDecimalForInput(value: string, locale: string): string {
  const trimmed = (value ?? "").trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return value ?? "";
  // Every decimal the value has, and no padding: "2.375" stays "2,375" (DecimalInput
  // reads that back as 2.375), "18.1234" keeps its four decimals.
  const decimals = (trimmed.split(".")[1] ?? "").replace(/0+$/, "").length;
  return formatMoneyInput(Number(trimmed), locale.split("-")[0], { maxDecimals: Math.max(3, decimals) });
}

/** A parsed number as a plain dot string, never in exponent form. */
function toCanonical(n: number, maxDecimals: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(maxDecimals).replace(/\.?0+$/, "");
}

export interface DecimalInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "type" | "defaultValue"> {
  /** Canonical value with a dot decimal mark ("2.5"), or "". */
  value: string;
  /** Called with the canonical dot string, or the raw text while it is not a number. */
  onValueChange: (value: string) => void;
  /** Most decimals accepted (quantity 3, unit price 4, VAT rate 2). */
  maxDecimals?: number;
  allowNegative?: boolean;
}

export function DecimalInput({
  value,
  onValueChange,
  maxDecimals = 2,
  allowNegative = false,
  ...props
}: DecimalInputProps) {
  const locale = useLocale();
  const [text, setText] = React.useState(() => formatDecimalForInput(value, locale));
  // The value this field last sent up: a different incoming value comes from
  // outside (a suggestion picked, a template applied) and replaces the text.
  const lastSent = React.useRef(value);

  React.useEffect(() => {
    if (value !== lastSent.current) {
      lastSent.current = value;
      setText(formatDecimalForInput(value, locale));
    }
  }, [value, locale]);

  // A quantity or unit price carries more than cents: "2,375" there is 2.375,
  // not a grouped 2375.
  const parseOpts: ParseMoneyInputOptions = {
    maxDecimals,
    allowNegative,
    ...(maxDecimals >= 3 ? { ambiguousGrouping: "decimal" as const } : {}),
  };
  const invalid = text.trim() !== "" && parseMoneyInput(text, parseOpts) === null;

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      aria-invalid={invalid || props["aria-invalid"] || undefined}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        const parsed = parseMoneyInput(raw, parseOpts);
        const next = parsed === null ? raw.trim() : toCanonical(parsed, maxDecimals);
        lastSent.current = next;
        onValueChange(next);
      }}
    />
  );
}

/** Read-only display of a stored decimal string with the locale's mark and grouping. */
export function formatDecimalForDisplay(value: string, locale: string, maxDecimals = 4): string {
  const n = Number(value);
  if (!Number.isFinite(n) || String(value ?? "").trim() === "") return value ?? "";
  return new Intl.NumberFormat(locale, { maximumFractionDigits: maxDecimals }).format(n);
}
