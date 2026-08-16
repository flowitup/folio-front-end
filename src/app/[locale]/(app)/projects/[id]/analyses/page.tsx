/**
 * Analyses page — server component.
 * Parallel fetches: project metadata + members + initial analyses list.
 * Auth-gated via getSession(); membership checked server-side (mirrors
 * the documents page pattern).
 */

import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getSession } from "@/lib/auth/session";
import { listProjectAnalyses, listProjectAnalysisTags } from "@/lib/api/project-analyses";
import { listMembers } from "@/lib/api/members";
import { getProjectById } from "@/lib/api/projects-server";
import { AnalysesPanel } from "./analyses-panel";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AnalysesPage({ params }: PageProps) {
  const { id: projectId } = await params;
  const locale = await getLocale();

  const session = await getSession();
  if (!session) {
    redirect(`/${locale}/login`);
  }

  // Parallel fetch — project metadata, members, the first page of analyses,
  // and the project's full tag vocabulary for the filter.
  const [project, members, analysesResult, availableTags] = await Promise.all([
    getProjectById(projectId).catch(() => null),
    listMembers(projectId).catch(() => []),
    listProjectAnalyses(projectId).catch(() => ({
      items: [],
      total: 0,
      page: 1,
      per_page: 24,
    })),
    listProjectAnalysisTags(projectId).catch(() => [] as string[]),
  ]);

  // Membership gate: admin (*:*) or project member (non-null project means
  // access granted by BE). Use the project's EFFECTIVE permissions (global ∪
  // membership-role perms) so a project admin sees the same controls as a
  // global admin.
  const effectivePerms = project?.my_permissions ?? session.user.permissions;
  const hasAdminPermission = effectivePerms.includes("*:*");

  // If the project fetch failed entirely (403/404), redirect.
  if (!project && !hasAdminPermission) {
    redirect(`/${locale}/projects`);
  }

  // Adapt ProjectMember[] to the shape the panel/card components expect.
  const adaptedMembers = members.map((m) => ({
    id: m.user_id,
    name: m.display_name ?? undefined,
    email: m.email,
  }));

  return (
    <div className="px-6 py-6">
      <AnalysesPanel
        projectId={projectId}
        initialAnalyses={analysesResult.items}
        initialTotal={analysesResult.total}
        availableTags={availableTags}
        members={adaptedMembers}
      />
    </div>
  );
}
