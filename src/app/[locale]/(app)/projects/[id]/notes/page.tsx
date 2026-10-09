/**
 * Notes page — server component.
 * Fetches initial notes list server-side; renders journal wall client component.
 * Auth-gated via getSession(); a project the caller cannot open (403/404)
 * redirects to the projects list.
 */

import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getSession } from "@/lib/auth/session";
import { listProjectNotes } from "@/lib/api/notes";
import { getProjectById } from "@/lib/api/projects-server";
import { can, isPlatformOps } from "@/lib/auth/permissions";
import { NotesView } from "./notes-view";
import { pageTitle } from "@/lib/i18n/page-title";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const generateMetadata = pageTitle("navigation.notes");

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

  // Access gate, as on the other project tabs: the project fetch fails
  // (403/404) for anyone who cannot see it, and the notes would read as an
  // empty journal with a quick-add that can only fail.
  if (!project && !isPlatformOps(session.user.permissions)) {
    redirect(`/${locale}/projects`);
  }

  // A member reads the journal but never writes it — the backend requires
  // effective project:update on every note write, so hide the write controls
  // rather than let them 403. Only a loaded project's effective permissions
  // can grant writes; the company-wide JWT claim alone does not reach it.
  const canEdit = project
    ? can("project:update", session.user.permissions, project.my_permissions)
    : false;

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
