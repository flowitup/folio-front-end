"use client";

import { useTranslations } from "next-intl";

/**
 * Error boundary for every page under a locale. The main case is a session
 * check the API could not answer (429 or 5xx, see getSession): the user is
 * still signed in, so offer a retry instead of the sign-in page or the
 * framework's bare "Application error".
 */
export default function LocaleError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errors.unavailable");
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
      <div className="max-w-md text-center" role="alert">
        <h1 className="font-display text-foreground text-3xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground mt-3">{t("body")}</p>
        <button type="button" onClick={() => reset()} className="btn btn-accent mt-6 inline-flex">
          {t("retry")}
        </button>
      </div>
    </div>
  );
}
