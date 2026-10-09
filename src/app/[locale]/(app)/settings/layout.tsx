import type { ReactNode } from "react";
import { pageTitle } from "@/lib/i18n/page-title";

/** Settings (profile and company pages): the tab title of the section. */
export const generateMetadata = pageTitle("navigation.settings");

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
