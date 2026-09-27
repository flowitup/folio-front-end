/**
 * Labor page — thin server component.
 *
 * The page itself is almost entirely client-driven (tabs, attendance,
 * summary, roster — see labor-page-client.tsx), but the roster tab's
 * initial date must be computed server-side and handed down as a plain
 * string: a client component's `useState(() => new Date())` initializer
 * runs during BOTH the server render pass and the browser hydration pass,
 * and those two clocks can disagree (container UTC vs. a browser in a
 * different timezone), producing a React #418 hydration mismatch right
 * around midnight. Computing it once here and passing it as a prop makes
 * the server-rendered HTML and the hydrated client agree by construction.
 *
 * Access gate, as on the other project tabs: someone who cannot see the
 * project (the project fetch fails) goes back to the projects list instead
 * of a manager shell full of "Failed to load" and 0,00 € figures.
 */

import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getSession } from "@/lib/auth/session";
import { getProjectById } from "@/lib/api/projects-server";
import { isPlatformOps } from "@/lib/auth/permissions";
import { LaborPageClient } from "./labor-page-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function LaborPage({ params }: PageProps) {
  const { id: projectId } = await params;
  const locale = await getLocale();

  const session = await getSession();
  if (!session) {
    redirect(`/${locale}/login`);
  }

  const project = await getProjectById(projectId).catch(() => null);
  if (!project && !isPlatformOps(session.user.permissions)) {
    redirect(`/${locale}/projects`);
  }

  const initialDate = new Date().toISOString().slice(0, 10);
  return <LaborPageClient initialDate={initialDate} />;
}
