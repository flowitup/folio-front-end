/**
 * i18n configuration
 * Defines supported locales and default locale
 */

export const locales = ['en', 'vi', 'fr'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export const localeNames: Record<Locale, string> = {
  en: 'English',
  vi: 'Tiếng Việt',
  fr: 'Français',
};
