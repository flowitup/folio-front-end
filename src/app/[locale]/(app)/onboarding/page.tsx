/**
 * Onboarding page — server component.
 *
 * Reached only via the (app) layout's no-company gate (or direct visit).
 * If the caller already has a company (raced with another tab, or navigated
 * here manually after onboarding elsewhere), bounce to the dashboard instead
 * of showing a screen that no longer applies.
 */

import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getSession } from "@/lib/auth/session";
import { OnboardingClient } from "./onboarding-client";
import { pageTitle } from "@/lib/i18n/page-title";
import { listDueNotifications } from "@/lib/api/notifications";
import { removedFromCompanyName } from "@/lib/onboarding/removed-from-company";

export const generateMetadata = pageTitle("meta.onboarding");

export default async function OnboardingPage() {
  const locale = await getLocale();
  const session = await getSession();

  if (!session) {
    redirect(`/${locale}/login`);
  }

  if ((session.user.companies ?? []).length > 0) {
    redirect(`/${locale}/dashboard`);
  }

  // Someone an admin removed from their only company lands here like a brand-new
  // user: the bell's removal event lets the page say what happened. Best effort —
  // the page works the same without it.
  let removedFrom: string | null = null;
  try {
    removedFrom = removedFromCompanyName((await listDueNotifications(locale)).events);
  } catch {
    removedFrom = null;
  }

  return <OnboardingClient removedFrom={removedFrom} />;
}
