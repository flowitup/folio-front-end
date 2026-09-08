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

export default async function OnboardingPage() {
  const locale = await getLocale();
  const session = await getSession();

  if (!session) {
    redirect(`/${locale}/login`);
  }

  if ((session.user.companies ?? []).length > 0) {
    redirect(`/${locale}/dashboard`);
  }

  return <OnboardingClient />;
}
