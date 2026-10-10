import type { ReactNode } from "react";
import { getLocale } from "next-intl/server";
import { redirectToOnboardingIfNeeded } from "@/lib/auth/onboarding-redirect";
import { pageTitle } from "@/lib/i18n/page-title";

/** Projects section: the tab title of the list and, unless a page sets its own, of a project's pages. */
export const generateMetadata = pageTitle("navigation.projects");

/** Also the onboarding gate: a direct link or a sidebar click from /onboarding
 * must not land a user with no company on an empty "waiting to be assigned" list. */
export default async function ProjectsLayout({ children }: { children: ReactNode }) {
  await redirectToOnboardingIfNeeded(await getLocale());
  return <>{children}</>;
}
