/**
 * The settings topic walks the reader through the page tab by tab, naming each tab in quotes.
 * Nothing tied those names to the nav, so a retired tab could leave its step behind and the guide
 * still shipped green: "About" outlived the move of the app version into the page footer, and the
 * "Team"/"Billing" placeholder gotcha outlived both entries. The catalogue parity test only counts
 * steps per locale, so it cannot see prose that contradicts the UI.
 *
 * This pins the walkthrough to what SettingsClient actually renders, in both directions. A quoted
 * name that opens a step or a gotcha is a claim about a settings section, so it has to be one the
 * nav still offers; and every section the nav offers has to be named by one of those lines. The
 * first direction catches a step that outlives its tab, the second a tab that ships without one —
 * which is what left Company and Users & Roles undocumented.
 *
 * Names quoted later in the sentence are left alone — those are notification categories and the
 * sidebar's own billing group, neither of which is a settings tab.
 *
 * The nav is read at its widest, so "Users & Roles" has to be documented even though only platform
 * ops can open it. That is deliberate: `visibility.ts` gates whole topics, and this one is
 * reachable by everyone, so hiding it would take the profile and notification steps away from the
 * readers who need them most. The step names its own audience instead.
 */

import { describe, it, expect, vi } from "vitest"
import { render, screen, within, cleanup } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"

import enMessages from "@/messages/en.json"
import frMessages from "@/messages/fr.json"
import viMessages from "@/messages/vi.json"
import { SettingsClient } from "@/app/[locale]/(app)/settings/settings-client"
import { helpCatalogueEn } from "../en"
import { helpCatalogueFr } from "../fr"
import { helpCatalogueVi } from "../vi"
import type { HelpCatalogue } from "../types"

// The nav is rendered at its widest — platform ops, with a project selected — so every entry any
// reader can reach counts as documented. A narrower render would fail steps that are correct.
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      email: "u@example.com",
      display_name: null,
      phone: null,
      permissions: ["*:*"],
    },
  }),
}))

vi.mock("@/context/ProjectContext", () => ({
  useProject: () => ({
    projects: [],
    selectedProjectId: "p1",
    selectedProject: { id: "p1", name: "Maison Lavandou" },
    selectProject: vi.fn(),
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}))

// ProfileForm (the default tab) refreshes the router after save, and its server action would pull
// in next/headers. Neither is exercised by a nav read, so both are stubbed.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

vi.mock("@/app/[locale]/(app)/settings/_actions/profile-actions", () => ({
  updateProfileAction: vi.fn(),
}))

vi.mock("@/app/[locale]/(app)/settings/users/users-section", () => ({
  UsersSection: () => <div data-testid="users-section" />,
}))

vi.mock("@/app/[locale]/(app)/settings/invoice-prefix-section", () => ({
  InvoicePrefixSection: () => <div data-testid="invoice-prefix-section" />,
}))

vi.mock("@/components/companies/company-settings-section", () => ({
  CompanySettingsSection: () => <div data-testid="company-settings-section" />,
}))

vi.mock("@/components/companies/admin-companies-section", () => ({
  AdminCompaniesSection: () => <div data-testid="admin-companies-section" />,
}))

type Locale = "en" | "fr" | "vi"

const MESSAGES = { en: enMessages, fr: frMessages, vi: viMessages }
const CATALOGUES: Record<Locale, HelpCatalogue> = {
  en: helpCatalogueEn,
  fr: helpCatalogueFr,
  vi: helpCatalogueVi,
}
const LOCALES: Locale[] = ["en", "fr", "vi"]

/** The labels the settings nav draws, for this locale, in its widest configuration. */
function navLabels(locale: Locale): string[] {
  render(
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
      <SettingsClient projects={[]} />
    </NextIntlClientProvider>
  )
  const labels = within(screen.getByRole("navigation"))
    .getAllByRole("button")
    .map((b) => b.textContent?.trim() ?? "")
  cleanup()
  return labels
}

/**
 * Everything before the first comma, colon, semicolon or full stop that falls outside a quoted
 * name — the clause that says which section the line is about. The scan skips punctuation inside
 * the quotes so a section whose own label carries a comma cannot truncate the clause.
 */
function openingClause(text: string): string {
  let inQuote = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === "“") inQuote = true
    else if (ch === "”") inQuote = false
    else if (!inQuote && ",;:.".includes(ch)) return text.slice(0, i)
  }
  return text
}

const quotedNames = (text: string): string[] =>
  [...text.matchAll(/“([^”]+)”/g)].map((m) => m[1])

/**
 * The page's own name. The topic opens by telling the reader to open Settings, and fr/vi quote it
 * when they do — that is the page, not one of its sections.
 */
const pageName = (locale: Locale): string =>
  (MESSAGES[locale] as { navigation: { settings: string } }).navigation.settings

/** The names this locale's settings topic claims to walk the reader through. */
function walkedNames(locale: Locale): string[] {
  const topic = CATALOGUES[locale].find((t) => t.id === "settings")
  if (!topic) throw new Error(`${locale}: no settings topic in the catalogue`)
  const lines = [...topic.steps, ...(topic.gotchas ?? [])]
  return lines.flatMap((line) => quotedNames(openingClause(line)))
}

/** Those of them that are sections rather than the page itself. */
const walkedSections = (locale: Locale): string[] =>
  walkedNames(locale).filter((name) => name !== pageName(locale))

describe("settings help topic vs the settings nav", () => {
  it.each(LOCALES)(
    "%s names only sections the nav still offers",
    (locale) => {
      const offered = [...navLabels(locale), pageName(locale)]

      for (const name of walkedNames(locale)) {
        expect(offered, `${locale}: the guide walks through "${name}"`).toContain(
          name
        )
      }
    }
  )

  it.each(LOCALES)("%s documents every section the nav offers", (locale) => {
    const walked = walkedSections(locale)

    for (const label of navLabels(locale)) {
      expect(walked, `${locale}: the nav offers "${label}"`).toContain(label)
    }
  })

  it("walks through the same sections in every locale", () => {
    // The two rules above already pin each locale's set of names to the nav's. This adds the
    // count, so a locale that opens two different steps with the same section name stands out.
    const counts = LOCALES.map((locale) => walkedSections(locale).length)
    expect(new Set(counts).size, `per-locale counts: ${counts.join(", ")}`).toBe(
      1
    )
    expect(counts[0]).toBeGreaterThan(0)
  })
})
