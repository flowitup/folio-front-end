import { defaultLocale, locales, type Locale } from "@/i18n/config"

import type { HelpCatalogue, HelpChrome } from "./types"

/** The catalogue and the panel's own labels, in one language. */
export type HelpGuide = { catalogue: HelpCatalogue; chrome: HelpChrome }

/**
 * One loader per locale, resolved on first use. The guide is large enough that importing all
 * three eagerly put every locale's prose into the app-shell chunk of every route, including the
 * two a given reader can never see. `src/i18n/request.ts` loads messages the same way.
 *
 * The chrome travels with the catalogue so a reader who picks another language for the guide
 * gets its headings in that language too, in the same single fetch.
 */
const LOADERS: Record<Locale, () => Promise<HelpGuide>> = {
  en: () =>
    import("./en").then((m) => ({
      catalogue: m.helpCatalogueEn,
      chrome: m.helpChromeEn,
    })),
  fr: () =>
    import("./fr").then((m) => ({
      catalogue: m.helpCatalogueFr,
      chrome: m.helpChromeFr,
    })),
  vi: () =>
    import("./vi").then((m) => ({
      catalogue: m.helpCatalogueVi,
      chrome: m.helpChromeVi,
    })),
}

/** The languages the guide can be read in — the reader picks one independently of the app's. */
export const HELP_LOCALES = locales

/** How each language names itself, so the picker reads the same whatever language you are in. */
export const HELP_LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  vi: "Tiếng Việt",
}

/** The reader's chosen guide language, falling back to the default for anything unknown. */
export function resolveHelpLocale(locale: string): Locale {
  return Object.hasOwn(LOADERS, locale) ? (locale as Locale) : defaultLocale
}

/** The workflow guide in a given language. */
export function loadHelpGuide(locale: string): Promise<HelpGuide> {
  return LOADERS[resolveHelpLocale(locale)]()
}

export type { HelpCatalogue, HelpChrome, HelpTopic } from "./types"
