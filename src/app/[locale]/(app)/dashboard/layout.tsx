/**
 * Dashboard layout — onboarding gate.
 *
 * A signed-in user with no company (fresh sign-up, or a company they
 * detached from) must create or join one before using the app. Sign-in
 * sends such a user to /dashboard even when a callbackUrl points elsewhere,
 * so this is the gate every post-login/post-signup session passes through;
 * the projects layout and the bibliotheque and inventory pages run the same
 * check for direct links. See `redirectToOnboardingIfNeeded`.
 */

import { getLocale } from "next-intl/server";
import { redirectToOnboardingIfNeeded } from "@/lib/auth/onboarding-redirect";
import { pageTitle } from "@/lib/i18n/page-title";

export const generateMetadata = pageTitle("navigation.dashboard");

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await redirectToOnboardingIfNeeded(await getLocale());

  return <>{children}</>;
}
