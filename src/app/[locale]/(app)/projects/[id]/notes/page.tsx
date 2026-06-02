/**
 * Notes page — server component.
 * Parallel fetches: project metadata + initial notes list.
 * Auth-gated via getSession(); 403/404 handled gracefully.
 */

import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getSession } from "@/lib/auth/session";
import { listProjectNotes } from "@/lib/api/notes";

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

  // `listProjectNotes` uses sessionAuthHeader() which DOES carry cookies on
  // the server side. We don't fetch project metadata here anymore — the
  // Topbar handles the page title/subtitle (see TOPBAR_KEYS.notes), and the
  // project name is already shown in the Topbar's breadcrumb via
  // ProjectContext.
  const notesResult = await listProjectNotes(projectId).catch(() => ({
    items: [],
    count: 0,
  }));

  // NotesView is wired in phase 05 — placeholder div keeps the page compilable.
  return (
    <div className="notes-wrap wide px-6 py-6">
      {/* NotesView rendered here after phase 05 */}
      <div data-notes-placeholder data-project-id={projectId} data-count={notesResult.count} />
    </div>
  );
}
