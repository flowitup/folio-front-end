"use client";

/**
 * MoneyInput — a euro amount typed the way the user writes it ("150,50",
 * "1 000,50", "150.50"), read with parseMoneyInput.
 *
 * A type="number" input drops the decimal comma in a browser whose UI is in
 * English ("150,50" becomes 15050) and shows English placeholders: labor rates,
 * day overrides and payments use this text input instead. The raw text is kept
 * while the user types; the parent gets the parsed amount, `undefined` for an
 * empty field and `NaN` for text that is not an amount (so its submit check
 * can refuse it with a message instead of saving a wrong number).
 */

import * as React from "react";
import { useLocale } from "next-intl";

import { Input } from "@/components/ui/input";
import { parseMoneyInput } from "@/lib/utils/parse-money-input";

/** Show a stored amount in the user's decimal mark ("150,5" in fr/vi). */
export function formatMoneyInputValue(value: number | undefined | null, locale: string): string {
  if (value == null || Number.isNaN(value)) return "";
  const text = String(Math.round(value * 100) / 100);
  return locale === "en" ? text : text.replace(".", ",");
}

/** Parse the text of a money field: the amount, undefined when empty, NaN when invalid. */
export function readMoneyInput(text: string): number | undefined {
  if (text.trim() === "") return undefined;
  return parseMoneyInput(text) ?? Number.NaN;
}

type NativeInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "type" | "value" | "defaultValue" | "onChange" | "inputMode"
>;

export interface MoneyInputProps extends NativeInputProps {
  /** The amount (controlled). undefined = empty; NaN keeps the typed text. */
  value: number | undefined;
  onValueChange: (next: number | undefined) => void;
}

export function MoneyInput({ value, onValueChange, placeholder, ...rest }: MoneyInputProps) {
  const locale = useLocale();
  const [text, setText] = React.useState(() => formatMoneyInputValue(value, locale));

  // Follow a value set from outside (form reset, "use last day"), but never
  // rewrite what the user is typing ("150," parses to 150 until they finish).
  React.useEffect(() => {
    const typed = readMoneyInput(text);
    const same = (typed === undefined && value === undefined) || (typed !== undefined && typed === value);
    if (!same && !(value !== undefined && Number.isNaN(value))) {
      setText(formatMoneyInputValue(value, locale));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only an outside change of `value` resyncs
  }, [value, locale]);

  return (
    <Input
      {...rest}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      placeholder={placeholder ?? (locale === "en" ? "100.00" : "100,00")}
      onChange={(e) => {
        setText(e.target.value);
        onValueChange(readMoneyInput(e.target.value));
      }}
    />
  );
}
