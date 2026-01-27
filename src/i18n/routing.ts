/**
 * next-intl routing configuration
 * Centralizes locale routing for middleware, navigation, and request handling
 */

import { defineRouting } from 'next-intl/routing';
import { locales, defaultLocale } from './config';

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'always',
});
