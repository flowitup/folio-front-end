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
  // Remember the chosen language for a year. Without maxAge next-intl writes a
  // session cookie, so the choice was lost whenever the browser was closed.
  localeCookie: { maxAge: 60 * 60 * 24 * 365 },
});
