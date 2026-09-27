import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

/**
 * Localized "not found" screen shared by the locale-level and app-level
 * not-found boundaries, so notFound() in any page (unknown document, template,
 * analysis or photo id) reads as "not found" instead of a session problem.
 */
export async function NotFoundView() {
  const locale = await getLocale();
  const t = await getTranslations("errors.notFound");
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
      <div className="max-w-md text-center">
        <h1 className="font-display text-foreground text-3xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground mt-3">{t("body")}</p>
        <Link href={`/${locale}/dashboard`} className="btn btn-accent mt-6 inline-flex">
          {t("back")}
        </Link>
      </div>
    </div>
  );
}
