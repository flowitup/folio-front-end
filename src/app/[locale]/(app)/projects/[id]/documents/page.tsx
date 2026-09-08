/**
 * Documents page — server component.
 * Parallel fetches: project metadata + initial members + initial documents list.
 * Auth-gated via getSession(); membership checked server-side.
 */

import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getSession } from "@/lib/auth/session";
import { listProjectDocuments, listDocumentTags } from "@/lib/api/project-documents";
import { listMembers } from "@/lib/api/members";
import { getProjectById } from "@/lib/api/projects-server";
import { can, isPlatformOps } from "@/lib/auth/permissions";
import { DocumentsPanel } from "./documents-panel";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DocumentsPage({ params }: PageProps) {
  const { id: projectId } = await params;
  const locale = await getLocale();

  const session = await getSession();
  if (!session) {
    redirect(`/${locale}/login`);
  }

  // Parallel fetch — project metadata, members, documents, and tags
  const [project, members, docsResult, tags] = await Promise.all([
    getProjectById(projectId).catch(() => null),
    listMembers(projectId).catch(() => []),
    listProjectDocuments(projectId).catch(() => ({
      items: [],
      total: 0,
      page: 1,
      per_page: 25,
    })),
    listDocumentTags(projectId).catch(() => [] as string[]),
  ]);

  // Membership gate: platform ops or project member (non-null project means access
  // granted by BE). Use the project's EFFECTIVE permissions (global ∪ membership-role
  // perms) so a project admin/manager sees the same controls as platform ops.
  const effectivePerms = project?.my_permissions ?? session.user.permissions;
  const hasAdminPermission = isPlatformOps(effectivePerms);

  // If the project fetch failed entirely (403/404), redirect
  if (!project && !hasAdminPermission) {
    redirect(`/${locale}/projects`);
  }

  // No owner_id bypass (D6, owner bypass removed) — edit rights follow the
  // same project:update permission admins/managers get from the matrix.
  const isAdminOrOwner = hasAdminPermission || can("project:update", session.user.permissions, project?.my_permissions);

  // Adapt ProjectMember[] to the shape the panel/list components expect
  const adaptedMembers = members.map((m) => ({
    id: m.user_id,
    firstName: m.display_name ?? undefined,
    email: m.email,
  }));

  return (
    <div className="px-6 py-6">
      <DocumentsPanel
        projectId={projectId}
        initialDocuments={docsResult.items}
        initialTotal={docsResult.total}
        initialTags={tags}
        members={adaptedMembers}
        currentUserId={session.user.id}
        isAdminOrOwner={isAdminOrOwner}
      />
    </div>
  );
}
