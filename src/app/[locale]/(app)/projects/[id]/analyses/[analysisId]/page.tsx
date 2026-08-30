/**
 * Analysis detail page — server component.
 * Fetches the analysis metadata server-side, resolves edit/delete rights
 * (uploader, project owner, or admin — see the BE routes.py authorization
 * note), and renders the header + sandboxed viewer.
 */

import { notFound, redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getSession } from "@/lib/auth/session";
import { getProjectAnalysis, listProjectAnalyses } from "@/lib/api/project-analyses";
import { listMembers } from "@/lib/api/members";
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

  // Project rights, uploader-name resolution, and the meta rail's
  // "in this library" sibling list — all optional, all fetched in parallel.
  const [project, members, siblingsResult] = await Promise.all([
    getProjectById(projectId).catch(() => null),
    listMembers(projectId).catch(() => []),
    listProjectAnalyses(projectId, { perPage: 6 }).catch(() => ({
      items: [],
      total: 0,
      page: 1,
      per_page: 6,
    })),
  ]);

  const effectivePerms = project?.my_permissions ?? session.user.permissions;
  const hasAdminPermission = effectivePerms.includes("*:*");
  const isProjectOwner = project?.owner_id === session.user.id;
  const isUploader = analysis.uploader_id === session.user.id;
  const canManage = hasAdminPermission || isProjectOwner || isUploader;

  const uploader = members.find((m) => m.user_id === analysis.uploader_id);
  const uploaderName = uploader?.display_name || uploader?.email || "";

  const siblings = siblingsResult.items
    .filter((a) => a.id !== analysis.id)
    .slice(0, 4)
    .map((a) => ({ id: a.id, title: a.title }));

  // Format server-side so client hydration renders the identical string
  // (server and browser timezones can disagree across midnight).
  const addedOn = new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(
    new Date(analysis.created_at)
  );

  return (
    // h-full fills the app shell's visible scroll area (the zoomed layout div
    // is h-full); a vh-based height would be scaled down by the shell's
    // zoom: 0.8 and leave dead space below the viewer.
    <div className="flex h-full min-h-[600px] flex-col gap-4 px-6 py-6">
      <AnalysisDetailPanel
        // Keyed by analysis id: the meta rail links to sibling analyses, and
        // without the key the un-keyed client component would keep the
        // previous report's useState across that same-segment navigation.
        key={analysisId}
        projectId={projectId}
        analysis={analysis}
        canManage={canManage}
        uploaderName={uploaderName}
        addedOn={addedOn}
        siblings={siblings}
      />
    </div>
  );
}
