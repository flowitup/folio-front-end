/**
 * Project section layout — one access gate for every /projects/<id>/... page.
 *
 * A project the caller cannot open (another company's, or one they are not on)
 * or that does not exist is refused by the API with 403/404. Every tab then
 * shows the same localized "not found" page inside the app shell, instead of
 * each page improvising: an empty notebook with a quick-add, an empty board
 * with "+" buttons, a full new-expense form, or a silent bounce to the list.
 * Any other failure (expired session, outage) is left to the page itself.
 *
 * It also hides the sections the project's company turned off (Settings ›
 * Company › Hidden sections): opening one by URL shows a short notice instead.
 */

import { notFound } from "next/navigation";
import { ApiError } from "@/lib/api/http";
import { getProjectById } from "@/lib/api/projects-server";
import { getSession } from "@/lib/auth/session";
import { hiddenProjectSections } from "@/lib/companies/hidden-sections";
import { ProjectSectionGuard } from "@/components/projects/project-section-guard";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const access = await getProjectById(id).then(
    (project) => ({ noAccess: false, companyId: project?.company_id ?? null }),
    (err: unknown) => ({
      noAccess: err instanceof ApiError && (err.status === 403 || err.status === 404),
      companyId: null,
    }),
  );
  if (access.noAccess) notFound();
  const companyId = access.companyId;

  const session = companyId ? await getSession().catch(() => null) : null;
  const hidden = companyId ? [...hiddenProjectSections(session?.user.companies, companyId)] : [];

  return (
    <ProjectSectionGuard projectId={id} hiddenSections={hidden}>
      {children}
    </ProjectSectionGuard>
  );
}
