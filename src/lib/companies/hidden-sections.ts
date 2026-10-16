/**
 * Company hidden sections (Settings › Company › Hidden sections, also set from
 * the mobile app). A company may turn off parts of the navigation for every
 * one of its members. Keys match the back end's `companies.hidden_sections`.
 *
 * - Project sections follow the company of the project they belong to.
 * - Company-wide areas (billing, library, inventory) span every company of the
 *   user, so one is hidden only when every company of the user hides it: a user
 *   in two companies still reaches the library of the one that uses it.
 */

export const HIDEABLE_SECTIONS = [
  "billing",
  "library",
  "inventory",
  "documents",
  "photos",
  "notes",
  "salaries",
  "chiffrage",
  "analyses",
] as const;

export type HideableSection = (typeof HIDEABLE_SECTIONS)[number];

/** Company-wide areas; the rest are project sections. */
export const COMPANY_AREAS: readonly HideableSection[] = ["billing", "library", "inventory"];

interface CompanyWithSections {
  id: string;
  hidden_sections?: string[] | null;
}

/**
 * Sections hidden on a project of `projectCompanyId`. Nothing is hidden while
 * the project's company is unknown, unless the user has a single company.
 */
export function hiddenProjectSections(
  companies: readonly CompanyWithSections[] | null | undefined,
  projectCompanyId: string | null | undefined,
): ReadonlySet<string> {
  const list = companies ?? [];
  const company = projectCompanyId
    ? list.find((c) => c.id === projectCompanyId)
    : list.length === 1
      ? list[0]
      : undefined;
  return new Set(company?.hidden_sections ?? []);
}

/** Company-wide areas every company of the user hides. */
export function hiddenCompanyAreas(
  companies: readonly CompanyWithSections[] | null | undefined,
): ReadonlySet<string> {
  const list = companies ?? [];
  if (list.length === 0) return new Set();
  return new Set(
    COMPANY_AREAS.filter((area) =>
      list.every((c) => (c.hidden_sections ?? []).includes(area)),
    ),
  );
}

/** Hideable section a project route belongs to (`/projects/<id>/<segment>`), if any. */
export function projectRouteSection(pathWithoutLocale: string): HideableSection | null {
  const match = /^\/projects\/[^/]+\/([^/?#]+)/.exec(pathWithoutLocale);
  if (!match) return null;
  const segment = match[1];
  switch (segment) {
    case "billing":
      return "billing";
    case "documents":
    case "photos":
    case "notes":
    case "chiffrage":
    case "analyses":
      return segment;
    default:
      return null;
  }
}

/** The companies that keep a company-wide area (the ones a page may show it for). */
export function companiesShowingArea<T extends CompanyWithSections>(
  companies: readonly T[],
  area: HideableSection,
): T[] {
  return companies.filter((c) => !(c.hidden_sections ?? []).includes(area));
}
