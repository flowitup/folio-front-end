"use client";

/**
 * Language of an exported file (xlsx / pdf), picked in the export dialogs.
 *
 * Defaults to the interface language (what exports always used); the last
 * choice is remembered per browser, so an owner using the app in Vietnamese
 * can keep sending French files to the accountant without picking each time.
 */

import { useState } from "react";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { locales, localeNames, type Locale } from "@/i18n/config";

export const EXPORT_LOCALE_KEY = "folio.export.locale";

/** Order shown in the picker. */
const ORDER: readonly Locale[] = ["vi", "fr", "en"];

function isLocale(value: string | null | undefined): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

function readStored(): Locale | null {
  try {
    const v = window.localStorage.getItem(EXPORT_LOCALE_KEY);
    return isLocale(v) ? v : null;
  } catch {
    return null;
  }
}

/** The export language: the remembered choice, else the interface language. */
export function useExportLocale(): [Locale, (next: Locale) => void] {
  const uiLocale = useLocale();
  const [picked, setPicked] = useState<Locale | null>(() => (typeof window === "undefined" ? null : readStored()));
  const value: Locale = picked ?? (isLocale(uiLocale) ? uiLocale : "en");
  const set = (next: Locale) => {
    setPicked(next);
    try {
      window.localStorage.setItem(EXPORT_LOCALE_KEY, next);
    } catch {
      // storage blocked: the choice lasts while the page is open
    }
  };
  return [value, set];
}

export interface ExportLanguageFieldProps {
  label: string;
  value: Locale;
  onChange: (next: Locale) => void;
}

/** "File language: Tiếng Việt / Français / English", each language in its own name. */
export function ExportLanguageField({ label, value, onChange }: ExportLanguageFieldProps) {
  return (
    <div className="space-y-2" data-testid="export-language-field">
      <Label>{label}</Label>
      <div className="mt-1 flex flex-wrap gap-2" role="group" aria-label={label}>
        {ORDER.map((loc) => (
          <Button
            key={loc}
            type="button"
            variant={value === loc ? "default" : "outline"}
            size="sm"
            lang={loc}
            aria-pressed={value === loc}
            onClick={() => onChange(loc)}
          >
            {localeNames[loc]}
          </Button>
        ))}
      </div>
    </div>
  );
}
