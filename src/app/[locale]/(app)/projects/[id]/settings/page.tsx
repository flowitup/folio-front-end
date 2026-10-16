import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getSession } from "@/lib/auth/session";
import { getAccessibleProject } from "@/lib/api/project-access";
import { ProjectSettingsClient } from "./project-settings-client";
import { pageTitle } from "@/lib/i18n/page-title";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const generateMetadata = pageTitle("navigation.projectSettings");

export default async function ProjectSettingsPage({ params }: PageProps) {
  const { id: projectId } = await params;
  const locale = await getLocale();

  const session = await getSession();
  if (!session) {
    redirect(`/${locale}/login`);
  }

  // 403/404 show the not-found page; an outage goes to the error boundary.
  const project = await getAccessibleProject(projectId, locale);

  return <ProjectSettingsClient project={project} />;
}
