import type { ReactNode } from "react";
import { pageTitle } from "@/lib/i18n/page-title";

/** A project's planning: a client page, so its tab title is set here. */
export const generateMetadata = pageTitle("navigation.planning");

export default function ProjectPlanningLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
