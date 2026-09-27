import { getLocale, getTranslations } from "next-intl/server";

/**
 * Rendered for notFound() anywhere under a locale (a missing or foreign
 * quote, invoice, template, project...). Without it the 404 surfaced as the
 * auth error boundary's English "Authentication Error" screen.
 */
export default async function NotFound() {
  const t = await getTranslations("notFoundPage");
  const locale = await getLocale();
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center">
        <h1 className="font-display text-5xl font-semibold">404</h1>
        <h2 className="mt-3 text-lg font-semibold">{t("title")}</h2>
        <p className="mt-2" style={{ color: "var(--muted)" }}>
          {t("body")}
        </p>
        <a href={`/${locale}/dashboard`} className="btn btn-primary mt-6 inline-flex">
          {t("backToDashboard")}
        </a>
      </div>
    </div>
  );
}
