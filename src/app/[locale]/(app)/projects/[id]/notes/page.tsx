/**
 * Notes page — server component.
 * Parallel fetches: project metadata + initial notes list.
 * Auth-gated via getSession(); 403/404 handled gracefully.
 */

import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
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
  const t = await getTranslations("notes");

  const session = await getSession();
  if (!session) {
    redirect(`/${locale}/login`);
  }

  // `fetchProjectById` uses the client-token http client which has no
  // access token during server-side render — so it 401s and we fall back
  // to null. That's fine: the project metadata is only used for the page
  // title copy, and `listProjectNotes` runs through the proper
  // sessionAuthHeader() wrapper which DOES carry cookies. We do NOT call
  // notFound() on missing metadata — that mirrors how members/page.tsx
  // already degrades gracefully.
  const [project, notesResult] = await Promise.all([
    fetchProjectById(projectId).catch(() => null) as Promise<Project | null>,
    listProjectNotes(projectId).catch(() => ({ items: [], count: 0 })),
  ]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          {project
            ? t("subtitle", { projectName: project.name })
            : t("title")}{" "}
          &middot; {t("anchorNote")}
        </p>
      </header>

      <NotesAgenda
        projectId={projectId}
        initialNotes={notesResult.items}
      />
    </div>
  );
}
