/**
 * Server-side onboarding gate for the (app) sections.
 *
 * A signed-in user with no company (fresh sign-up, or a company they
 * detached from) must create or join one before using the app. The shared
 * (app) layout cannot hold this gate: it also wraps /onboarding, and Next
 * does not re-render it on a client navigation, so a sidebar link followed
 * from /onboarding would skip it. The dashboard and projects layouts and
 * the bibliotheque and inventory pages call this instead (those pages before
 * their own company lookup); /onboarding and /settings stay reachable, and
 * billing and company pages already send anyone who admins no company to the
 * app home, which is /dashboard.
 *
 * Platform ops (flowitup support, `*:*`) never has a company and never
 * needs one, so it is exempt. A user with zero companies but a visible
 * project (e.g. removed from every company but still assigned somewhere)
 * is also exempt — see `shouldRedirectToOnboarding`.
 */

import "server-only";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { isPlatformOps } from "@/lib/auth/permissions";
import { shouldRedirectToOnboarding } from "@/lib/auth/onboarding-gate";
import { listProjects } from "@/lib/api/projects-server";

export async function redirectToOnboardingIfNeeded(locale: string): Promise<void> {
  const session = await getSession();
  // No session: the shared (app) layout already redirects to /login for
  // every route — this is defense-in-depth only.
  if (!session) return;

  const companiesCount = (session.user.companies ?? []).length;
  const platformOps = isPlatformOps(session.user.permissions);

  // Cheap check only when it can change the outcome — skip the extra
  // request for platform ops / users who already have a company.
  let hasVisibleProjects = true;
  if (!platformOps && companiesCount === 0) {
    try {
      const projects = await listProjects();
      hasVisibleProjects = projects.length > 0;
    } catch {
      // Fail open: a transient API error must never cause a redirect
      // loop into onboarding for a user who may already have a project.
      hasVisibleProjects = true;
    }
  }

  if (
    shouldRedirectToOnboarding({
      isPlatformOps: platformOps,
      companiesCount,
      hasVisibleProjects,
    })
  ) {
    redirect(`/${locale}/onboarding`);
  }
}
