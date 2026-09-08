/**
 * Photos page — server component.
 * Parallel fetches: project metadata + first page of photos.
 * Auth-gated via getSession(); project access checked server-side.
 */

import { redirect, notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getSession } from "@/lib/auth/session";
import { getProjectById } from "@/lib/api/projects-server";
import { listProjectPhotos } from "@/lib/api/project-photos";
import { can, isPlatformOps } from "@/lib/auth/permissions";
import { PhotosGallery } from "./photos-gallery";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PhotosPage({ params }: PageProps) {
  const { id: projectId } = await params;
  const locale = await getLocale();

  const session = await getSession();
  if (!session) {
    redirect(`/${locale}/login`);
  }

  // Parallel fetch — project metadata + initial photo list
  const [project, photosResult] = await Promise.all([
    getProjectById(projectId).catch(() => null),
    listProjectPhotos(projectId, { page: 1, perPage: 50 }).catch(() => ({
      items: [],
      total: 0,
      page: 1,
      perPage: 50,
    })),
  ]);

  // Project not found or no access → 404
  if (!project) {
    notFound();
  }

  // Effective per-project perms (global ∪ membership-role) so a project
  // admin/manager gets edit access. No owner_id bypass (D6, removed).
  const effectivePerms = project.my_permissions ?? session.user.permissions;
  const hasAdminPermission = isPlatformOps(effectivePerms);
  const canEdit = hasAdminPermission || can("project:update", session.user.permissions, project.my_permissions);
  const currentUserId = session.user.id;

  return (
    <div className="px-6 py-6">
      <PhotosGallery
        projectId={projectId}
        initialPhotos={photosResult.items}
        initialTotal={photosResult.total}
        canEdit={canEdit}
        currentUserId={currentUserId}
      />
    </div>
  );
}
