/**
 * Notes page — server component.
 * Fetches initial notes list server-side; renders journal wall client component.
 * Auth-gated via getSession(); 403/404 handled gracefully.
 */

import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getSession } from "@/lib/auth/session";
import { listProjectNotes } from "@/lib/api/notes";
import { getProjectById } from "@/lib/api/projects-server";
import { can, isPlatformOps } from "@/lib/auth/permissions";
import { NotesView } from "./notes-view";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function NotesPage({ params }: PageProps) {
  const { id: projectId } = await params;
  const locale = await getLocale();

  const session = await getSession();
  if (!session) {
    redirect(`/${locale}/login`);
  }

  // `listProjectNotes` uses sessionAuthHeader() which carries cookies server-side.
  // Topbar renders page title/subtitle via TOPBAR_KEYS.notes; project name shown
  // in the breadcrumb via ProjectContext.
  const [notesResult, project] = await Promise.all([
    listProjectNotes(projectId).catch(() => ({ items: [], count: 0 })),
    getProjectById(projectId).catch(() => null),
  ]);

  // A member reads the journal but never writes it — the backend requires
  // effective project:update on every note write, so hide the write controls
  // rather than let them 403.
  const canEdit =
    isPlatformOps(project?.my_permissions ?? session.user.permissions) ||
    can("project:update", session.user.permissions, project?.my_permissions);

  return (
    <div className="px-6 py-6">
      <NotesView
        projectId={projectId}
        initialNotes={notesResult.items}
        canEdit={canEdit}
      />
    </div>
  );
}
