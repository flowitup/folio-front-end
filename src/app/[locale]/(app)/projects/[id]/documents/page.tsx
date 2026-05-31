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

  // Membership gate: admin (*:*) or project member (non-null project means access granted by BE)
  const hasAdminPermission = session.user.permissions.includes("*:*");
  const isProjectOwner = project?.owner_id === session.user.id;

  // If the project fetch failed entirely (403/404), redirect
  if (!project && !hasAdminPermission) {
    redirect(`/${locale}/projects`);
  }

  const isAdminOrOwner = hasAdminPermission || isProjectOwner;

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
