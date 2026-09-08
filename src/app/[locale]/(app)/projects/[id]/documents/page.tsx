/**
 * Documents page — server component.
 * Documents are admin/manager-only: the backend requires effective
 * `project:update` on EVERY documents route, list and download included, so
 * the project is resolved first and the rest of the data is only fetched for
 * a caller who may actually read it. A member gets a calm "not available"
 * panel instead of a wall of 403 toasts.
 */

import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Lock } from "lucide-react";
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

  const project = await getProjectById(projectId).catch(() => null);

  // Membership gate: platform ops or project member (non-null project means
  // access granted by BE). Use the project's EFFECTIVE permissions (global ∪
  // membership-role perms) so a project admin/manager sees the same controls
  // as platform ops.
  const effectivePerms = project?.my_permissions ?? session.user.permissions;
  const hasAdminPermission = isPlatformOps(effectivePerms);

  // If the project fetch failed entirely (403/404), redirect
  if (!project && !hasAdminPermission) {
    redirect(`/${locale}/projects`);
  }

  // No owner_id bypass (D6, owner bypass removed) — read AND edit rights both
  // follow the project:update permission admins/managers get from the matrix.
  const isAdminOrOwner =
    hasAdminPermission ||
    can("project:update", session.user.permissions, project?.my_permissions);

  if (!isAdminOrOwner) {
    const t = await getTranslations("documents.restricted");
    return (
      <div className="px-6 py-6">
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <Lock className="size-7 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium">{t("title")}</p>
          <p className="max-w-md text-sm text-muted-foreground">{t("body")}</p>
        </div>
      </div>
    );
  }

  // Parallel fetch — members, documents, and tags
  const [members, docsResult, tags] = await Promise.all([
    listMembers(projectId).catch(() => []),
    listProjectDocuments(projectId).catch(() => ({
      items: [],
      total: 0,
      page: 1,
      per_page: 25,
    })),
    listDocumentTags(projectId).catch(() => [] as string[]),
  ]);

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
