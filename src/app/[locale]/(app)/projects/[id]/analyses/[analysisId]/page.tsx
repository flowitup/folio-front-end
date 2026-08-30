/**
 * Analysis detail page — server component.
 * Fetches the analysis metadata server-side, resolves edit/delete rights
 * (uploader, project owner, or admin — see the BE routes.py authorization
 * note), and renders the header + sandboxed viewer.
 */

import { notFound, redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getSession } from "@/lib/auth/session";
import { getProjectAnalysis } from "@/lib/api/project-analyses";
import { getProjectById } from "@/lib/api/projects-server";
import { AnalysisDetailPanel } from "./analysis-detail-panel";

interface PageProps {
  params: Promise<{ id: string; analysisId: string }>;
}

export default async function AnalysisDetailPage({ params }: PageProps) {
  const { id: projectId, analysisId } = await params;
  const locale = await getLocale();

  const session = await getSession();
  if (!session) {
    redirect(`/${locale}/login`);
  }

  let analysis;
  try {
    analysis = await getProjectAnalysis(projectId, analysisId);
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 404) notFound();
    if (status === 403) redirect(`/${locale}/projects/${projectId}/analyses`);
    throw err;
  }

  const project = await getProjectById(projectId).catch(() => null);
  const effectivePerms = project?.my_permissions ?? session.user.permissions;
  const hasAdminPermission = effectivePerms.includes("*:*");
  const isProjectOwner = project?.owner_id === session.user.id;
  const isUploader = analysis.uploader_id === session.user.id;
  const canManage = hasAdminPermission || isProjectOwner || isUploader;

  return (
    // h-full fills the app shell's visible scroll area (the zoomed layout div
    // is h-full); a vh-based height would be scaled down by the shell's
    // zoom: 0.8 and leave dead space below the viewer.
    <div className="flex h-full min-h-[600px] flex-col gap-4 px-6 py-6">
      <AnalysisDetailPanel projectId={projectId} analysis={analysis} canManage={canManage} />
    </div>
  );
}
