/**
 * Dashboard layout — onboarding gate.
 *
 * A signed-in user with no company (fresh sign-up, or a company they
 * detached from) must create or join one before using the app. Enforced
 * here rather than the shared (app) layout because AuthContext.login()
 * always redirects to /dashboard on success — this is the one page every
 * post-login/post-signup session is guaranteed to pass through — and this
 * layout is scoped ONLY to /dashboard, so it never wraps /onboarding itself
 * (no self-redirect loop to guard against, unlike a shared top-level gate).
 *
 * Platform ops (flowitup support, `*:*`) never has a company and never
 * needs one, so it is exempt. A user with zero companies but a visible
 * project (e.g. removed from every company but still assigned somewhere)
 * is also exempt — see `shouldRedirectToOnboarding`.
 */

import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getSession } from "@/lib/auth/session";
import { isPlatformOps } from "@/lib/auth/permissions";
import { shouldRedirectToOnboarding } from "@/lib/auth/onboarding-gate";
import { listProjects } from "@/lib/api/projects-server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const session = await getSession();

  // No session: the shared (app) layout already redirects to /login for
  // every route including this one — this is defense-in-depth only.
  if (session) {
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

  return <>{children}</>;
}
