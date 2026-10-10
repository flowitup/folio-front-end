import type { ReactNode } from "react";
import { pageTitle } from "@/lib/i18n/page-title";

/** A project's analyses (list and detail): the tab title of the section. */
export const generateMetadata = pageTitle("navigation.analyses");

export default function AnalysesLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
