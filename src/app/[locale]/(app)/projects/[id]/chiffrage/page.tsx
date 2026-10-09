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
import { can, isPlatformOps } from "@/lib/auth/permissions";
import { getChiffrage, listUnits, type ChiffrageTree, type ChiffrageUnit } from "@/lib/api/chiffrage";
import { getProjectById } from "@/lib/api/projects-server";
import { ChiffragePageClient } from "./chiffrage-page-client";
import { pageTitle } from "@/lib/i18n/page-title";

interface PageProps {
  params: Promise<{ id: string }>;
}

const EMPTY_TREE = (projectId: string): ChiffrageTree => ({
  project_id: projectId,
  postes: [],
  rooms: [],
  stores: [],
  store_baskets: [],
  total_ht: 0,
  total_ttc: 0,
  unpriced_article_count: 0,
});

export const generateMetadata = pageTitle("navigation.chiffrage");

export default async function ChiffragePage({ params }: PageProps) {
  const { id: projectId } = await params;
  const locale = await getLocale();

  const session = await getSession();
  if (!session) {
    redirect(`/${locale}/login`);
  }

  // Access gate, as on the other project tabs: the project fetch fails
  // (403/404) for anyone who cannot see it.
  const project = await getProjectById(projectId).catch(() => null);
  if (!project && !isPlatformOps(session.user.permissions)) {
    redirect(`/${locale}/projects`);
  }

  const [treeResult, units] = await Promise.all([
    getChiffrage(projectId).then(
      (data) => ({ ok: true as const, data }),
      () => ({ ok: false as const })
    ),
    listUnits(projectId).catch((): ChiffrageUnit[] => []),
  ]);
  // A failed load is shown as an error with a retry — never as an empty
  // budget, which reads as if the sections had been lost.
  const loadFailed = !treeResult.ok;
  const tree = treeResult.ok ? treeResult.data : EMPTY_TREE(projectId);

  // Only a loaded project's effective permissions can grant writes; the
  // company-wide JWT claim alone does not reach this project.
  const canManage = project
    ? can("project:manage_invoices", session.user.permissions, project.my_permissions)
    : false;

  return (
    <div className="px-6 py-6">
      <ChiffragePageClient
        projectId={projectId}
        canManage={canManage}
        companyId={project?.company_id ?? null}
        initialTree={tree}
        initialUnits={units}
        loadFailed={loadFailed}
      />
    </div>
  );
}
