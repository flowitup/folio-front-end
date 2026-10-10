import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

interface LocaleParams {
  params: Promise<{ locale: string }>;
}

/**
 * The browser-tab title of a page or section ("Labor · Folio"), translated
 * into the URL's locale. `key` is a full message key ("navigation.labor").
 *
 * The title is absolute: a section layout's title would otherwise drop the
 * [locale] layout's template for every page below it.
 *
 *   export const generateMetadata = pageTitle("navigation.labor");
 */
export function pageTitle(key: string) {
  return async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({ locale });
    return { title: { absolute: `${t(key)} · ${t("common.appName")}` } };
  };
}
