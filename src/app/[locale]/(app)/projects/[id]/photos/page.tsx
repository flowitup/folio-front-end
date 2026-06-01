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

  const hasAdminPermission = session.user.permissions.includes("*:*");
  const isProjectOwner = project.owner_id === session.user.id;
  const canEdit = hasAdminPermission || isProjectOwner;

  return (
    <div className="px-6 py-6">
      <PhotosGallery
        projectId={projectId}
        initialPhotos={photosResult.items}
        initialTotal={photosResult.total}
        canEdit={canEdit}
      />
    </div>
  );
}
