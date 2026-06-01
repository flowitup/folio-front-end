"use client";

import { useLocale, useTranslations } from "next-intl";
import { Globe, ChevronDown } from "lucide-react";
import { useRouter, usePathname } from "@/i18n/navigation";
import { locales, localeNames, type Locale } from "@/i18n/config";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Top-right language control: a quiet Globe + locale-code button that opens a
 * dropdown of supported locales. next-intl's locale-aware router.replace swaps
 * only the locale prefix, preserving pathname + query.
 */
export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const tCommon = useTranslations("common");

  const handleChange = (next: Locale) => {
    if (next === locale) return;
    router.replace(pathname, { locale: next });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="btn btn-quiet gap-1.5"
          aria-label={tCommon("language")}
        >
          <Globe size={16} />
          <span className="text-[13px] font-medium">{locale.toUpperCase()}</span>
          <ChevronDown size={12} style={{ color: "var(--muted)" }} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {locales.map((loc) => (
          <DropdownMenuItem
            key={loc}
            onClick={() => handleChange(loc)}
            className="flex items-center gap-2"
          >
            <span className="font-medium">{loc.toUpperCase()}</span>
            <span className="text-[11px]" style={{ color: "var(--muted)" }}>
              {localeNames[loc]}
            </span>
            {locale === loc && (
              <span
                className="ml-auto text-[11px]"
                style={{ color: "var(--accent-ink)" }}
              >
                ✓
              </span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
