/**
 * Notes page — server component.
 * Parallel fetches: project metadata + initial notes list.
 * Auth-gated via getSession(); 403/404 handled gracefully.
 */

import { notFound, redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getSession } from "@/lib/auth/session";
import { fetchProjectById } from "@/lib/api/projects";
import { listProjectNotes } from "@/lib/api/notes";
import { NotesAgenda } from "./notes-agenda";
import type { Project } from "@/types/project";

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

  const [project, notesResult] = await Promise.all([
    fetchProjectById(projectId).catch(() => null) as Promise<Project | null>,
    listProjectNotes(projectId).catch(() => ({ items: [], count: 0 })),
  ]);

  if (!project) {
    notFound();
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Notes</h1>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          Things to remember for {project.name} &middot; Reminders fire at 09:00 UTC
        </p>
      </header>

      <NotesAgenda
        projectId={projectId}
        initialNotes={notesResult.items}
      />
    </div>
  );
}
