"use client";

/**
 * App-wide month picker (value "YYYY-MM").
 *
 * Replaces <input type="month">, which desktop Firefox and Safari on macOS
 * render as a plain text box: the "hidden native input + showPicker()"
 * pattern then did nothing at all (the Payments tab was stuck on the current
 * month) and typed values such as "09/2026" failed with a generic error.
 * This popover works the same in every browser: year arrows and a 12-month
 * grid, all keyboard reachable.
 */

import { useState, type ReactElement } from "react";
import { useTranslations } from "next-intl";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

function parseMonth(value: string | null | undefined): { year: number; month: number } | null {
  const m = MONTH_RE.exec(value ?? "");
  return m ? { year: Number(m[1]), month: Number(m[2]) } : null;
}

function toValue(year: number, month: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

function currentMonthValue(): string {
  const now = new Date();
  return toValue(now.getFullYear(), now.getMonth() + 1);
}

/** "octobre 2026" / "October 2026" / "tháng 10 năm 2026" for a "YYYY-MM" value. */
export function formatMonthLabel(value: string, locale: string): string {
  const parsed = parseMonth(value);
  if (!parsed) return "";
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(parsed.year, parsed.month - 1, 1)),
  );
}

type MonthPickerPopoverProps = {
  value: string;
  onChange: (value: string) => void;
  /** Earliest / latest selectable month ("YYYY-MM"), inclusive. */
  min?: string;
  max?: string;
  /** The element that opens the picker (rendered asChild). */
  children: ReactElement;
  align?: "start" | "center" | "end";
};

/** A month grid in a popover, opened by any trigger element. */
export function MonthPickerPopover({
  value,
  onChange,
  min,
  max,
  children,
  align = "start",
}: MonthPickerPopoverProps) {
  const t = useTranslations("common.monthPicker");
  // The page language (<html lang> is the app locale), read lazily so this
  // picker needs nothing beyond translations from next-intl.
  const locale = typeof document !== "undefined" ? document.documentElement.lang || "fr" : "fr";
  const [open, setOpen] = useState(false);
  const selected = parseMonth(value);
  const [year, setYear] = useState<number>(
    () => selected?.year ?? parseMonth(currentMonthValue())!.year,
  );

  const monthName = (m: number) =>
    new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(
      new Date(Date.UTC(2000, m - 1, 1)),
    );

  const outOfRange = (v: string) => (!!min && v < min) || (!!max && v > max);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setYear(parseMonth(value)?.year ?? parseMonth(currentMonthValue())!.year);
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align={align} className="w-64 p-3">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded-md hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setYear((y) => y - 1)}
            aria-label={t("previousYear")}
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <span className="text-sm font-medium tabular-nums" aria-live="polite">
            {year}
          </span>
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded-md hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setYear((y) => y + 1)}
            aria-label={t("nextYear")}
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1" role="group" aria-label={String(year)}>
          {Array.from({ length: 12 }, (_, i) => {
            const m = i + 1;
            const v = toValue(year, m);
            const isSelected = selected?.year === year && selected.month === m;
            const disabled = outOfRange(v);
            return (
              <button
                key={m}
                type="button"
                disabled={disabled}
                aria-pressed={isSelected}
                aria-label={formatMonthLabel(v, locale)}
                onClick={() => {
                  onChange(v);
                  setOpen(false);
                }}
                className={cn(
                  "rounded-md px-2 py-1.5 text-sm capitalize focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40",
                  isSelected ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                {monthName(m)}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Turn what a user typed into "YYYY-MM" when it is a recognisable month
 * ("2026-09", "09/2026", "9/2026", "09-2026", "2026/09"); anything else is
 * returned unchanged so the caller can show an inline format error.
 */
export function normalizeMonthInput(raw: string): string {
  const text = raw.trim();
  if (MONTH_RE.test(text)) return text;
  let m = /^(\d{1,2})\s*[/.-]\s*(\d{4})$/.exec(text);
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12) return toValue(Number(m[2]), Number(m[1]));
  m = /^(\d{4})\s*[/.]\s*(\d{1,2})$/.exec(text);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return toValue(Number(m[1]), Number(m[2]));
  return raw;
}

/** True for a complete "YYYY-MM" value. */
export function isMonthValue(value: string): boolean {
  return MONTH_RE.test(value);
}

type MonthFieldProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  "data-testid"?: string;
};

/**
 * A month form field: a text box that accepts "AAAA-MM" (and "MM/AAAA"),
 * plus a calendar button that opens the month grid. Works the same in every
 * browser, unlike <input type="month">.
 */
export function MonthField({
  id,
  value,
  onChange,
  min,
  max,
  placeholder,
  disabled,
  required,
  className,
  ...rest
}: MonthFieldProps) {
  const t = useTranslations("common.monthPicker");
  return (
    <div className={cn("relative flex items-center", className)}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        placeholder={placeholder ?? t("placeholder")}
        onChange={(e) => onChange(normalizeMonthInput(e.target.value))}
        onBlur={(e) => {
          const normalized = normalizeMonthInput(e.target.value);
          if (normalized !== value) onChange(normalized);
        }}
        disabled={disabled}
        required={required}
        aria-label={rest["aria-label"]}
        aria-invalid={rest["aria-invalid"]}
        aria-describedby={rest["aria-describedby"]}
        data-testid={rest["data-testid"]}
        className="h-9 w-full min-w-0 rounded-md border bg-background py-1.5 pl-3 pr-10 text-sm tabular-nums shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      />
      <MonthPickerPopover value={isMonthValue(value) ? value : ""} onChange={onChange} min={min} max={max} align="end">
        <button
          type="button"
          disabled={disabled}
          aria-label={t("open")}
          title={t("open")}
          className="absolute right-1 flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          <Calendar className="size-4" aria-hidden />
        </button>
      </MonthPickerPopover>
    </div>
  );
}
