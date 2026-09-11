import { defaultLocale, type Locale } from "@/i18n/config"

import type { HelpCatalogue } from "./types"

/**
 * One loader per locale, resolved on first use. The catalogues are large enough that importing
 * all three eagerly put every locale's prose into the app-shell chunk of every route, including
 * the two a given reader can never see. `src/i18n/request.ts` loads messages the same way.
 */
const LOADERS: Record<Locale, () => Promise<HelpCatalogue>> = {
  en: () => import("./en").then((m) => m.helpCatalogueEn),
  fr: () => import("./fr").then((m) => m.helpCatalogueFr),
  vi: () => import("./vi").then((m) => m.helpCatalogueVi),
}

/** The workflow guide for a locale, falling back to the default locale for anything unknown. */
export function loadHelpCatalogue(locale: string): Promise<HelpCatalogue> {
  const load = Object.hasOwn(LOADERS, locale)
    ? LOADERS[locale as Locale]
    : LOADERS[defaultLocale]
  return load()
}

export type { HelpCatalogue, HelpTopic } from "./types"
