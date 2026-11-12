import type { ReactNode } from "react";
import { getLocale } from "next-intl/server";
import { redirectToOnboardingIfNeeded } from "@/lib/auth/onboarding-redirect";
import { pageTitle } from "@/lib/i18n/page-title";

export const generateMetadata = pageTitle("navigation.companySummary");

export default async function CompanySummaryLayout({ children }: { children: ReactNode }) {
  await redirectToOnboardingIfNeeded(await getLocale());
  return <>{children}</>;
}
