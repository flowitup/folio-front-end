/**
 * Chiffrage page — server component.
 *
 * Fetches the costing tree and the unit vocabulary server-side, then hands them
 * to the client shell. Write affordances are gated on the caller's EFFECTIVE
 * permissions for this project (global role UNION their membership role), so a
 * user invited as a project manager sees the controls their role grants.
 */

import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";

import { getSession } from "@/lib/auth/session";
import { canOnProject } from "@/lib/auth/project-permissions";
import { getChiffrage, listUnits, type ChiffrageTree, type ChiffrageUnit } from "@/lib/api/chiffrage";
import { getProjectById } from "@/lib/api/projects-server";
import { ChiffragePageClient } from "./chiffrage-page-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

const EMPTY_TREE = (projectId: string): ChiffrageTree => ({
  project_id: projectId,
  postes: [],
    rooms: [],
  total_ht: 0,
  total_ttc: 0,
  unpriced_article_count: 0,
});

export default async function ChiffragePage({ params }: PageProps) {
  const { id: projectId } = await params;
  const locale = await getLocale();

  const session = await getSession();
  if (!session) {
    redirect(`/${locale}/login`);
  }

  const [tree, units, project] = await Promise.all([
    getChiffrage(projectId).catch(() => EMPTY_TREE(projectId)),
    listUnits(projectId).catch((): ChiffrageUnit[] => []),
    getProjectById(projectId).catch(() => null),
  ]);

  const canManage = canOnProject(
    "project:manage_invoices",
    session.user.permissions,
    project?.my_permissions
  );

  return (
    <div className="px-6 py-6">
      <ChiffragePageClient
        projectId={projectId}
        canManage={canManage}
        companyId={project?.company_id ?? null}
        initialTree={tree}
        initialUnits={units}
      />
    </div>
  );
}
