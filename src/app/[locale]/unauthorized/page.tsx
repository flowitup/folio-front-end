import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

/** 403 screen in the visitor's language, linking to their locale's dashboard. */
export default async function UnauthorizedPage() {
  const locale = await getLocale();
  const t = await getTranslations("errors");
  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4">
      <div className="text-center">
        <h1 className="font-display text-foreground text-5xl font-semibold">403</h1>
        <p className="text-muted-foreground mt-3 text-lg">{t("accessDenied")}</p>
        <Link href={`/${locale}/dashboard`} className="btn btn-accent mt-6">
          {t("notFound.back")}
        </Link>
      </div>
    </div>
  );
}
