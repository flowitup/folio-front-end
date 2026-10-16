import type { MetadataRoute } from "next";
import { locales } from "@/i18n/config";

/**
 * Folio is a private app: only the public legal pages (privacy policy,
 * support — linked from the store listings) may be indexed.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: locales.map((locale) => `/${locale}/legal/`),
      disallow: "/",
    },
  };
}
