/**
 * Tags page — server component.
 * Fetches project phase tags + cost summary using sessionAuthHeader
 * (projects-server pattern). Renders TagManager + TagSummaryTable.
 */

import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getSession } from "@/lib/auth/session";
import { listTags, getTagSummary } from "@/lib/api/tags";
import { TagManager } from "@/components/tags/tag-manager";
import { TagSummaryTable } from "@/components/tags/tag-summary-table";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TagsPage({ params }: PageProps) {
  const { id: projectId } = await params;
  const locale = await getLocale();
  const t = await getTranslations("tags");

  const session = await getSession();
  if (!session) {
    redirect(`/${locale}/login`);
  }

  // Parallel fetch — both non-fatal: degrade gracefully on error.
  const [tagsResult, summaryResult] = await Promise.allSettled([
    listTags(projectId),
    getTagSummary(projectId),
  ]);

  const initialTags =
    tagsResult.status === "fulfilled" ? tagsResult.value.items : [];

  const summaryRows =
    summaryResult.status === "fulfilled" ? summaryResult.value.rows : [];

  return (
    <div className="space-y-8 px-6 py-6">
      {/* Manage tags section */}
      <section>
        <TagManager projectId={projectId} initialTags={initialTags} />
      </section>

      {/* Cost summary section */}
      <section>
        <h2 className="mb-3 text-sm font-semibold">{t("summary.title")}</h2>
        <TagSummaryTable rows={summaryRows} />
      </section>
    </div>
  );
}
