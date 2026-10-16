"use client";

import { useTranslations } from "next-intl";

interface LegalLinksProps {
  /** Locale prefix of the links: the pages exist under every locale. */
  locale: string;
  /** "ink" over the dark sign-in board, "paper" everywhere else. */
  tone?: "ink" | "paper";
  className?: string;
}

/**
 * Support and privacy policy, for people who get stuck before or after signing
 * in. Both pages are public (see PUBLIC_PATH_PREFIXES), so the links work from
 * the sign-in and invitation screens too.
 */
export function LegalLinks({ locale, tone = "paper", className }: LegalLinksProps) {
  const t = useTranslations("legalLinks");
  const color = tone === "ink" ? "#d9d2c5" : "var(--muted)";
  return (
    <nav
      aria-label={t("label")}
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] ${className ?? ""}`}
      style={{ color }}
      data-testid="legal-links"
    >
      <a href={`/${locale}/legal/support`} className="underline underline-offset-2" style={{ color }}>
        {t("support")}
      </a>
      <span aria-hidden="true">·</span>
      <a href={`/${locale}/legal/privacy`} className="underline underline-offset-2" style={{ color }}>
        {t("privacy")}
      </a>
    </nav>
  );
}
