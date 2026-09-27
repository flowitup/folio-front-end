/**
 * /persons-merge — support tool to consolidate duplicate Person rows.
 *
 * Hosts <PersonMergeForm>, backed by POST /api/v1/persons/<id>/merge. The API
 * answers platform ops only, so the page does too: anyone else gets a 404
 * rather than a form whose every merge fails.
 */

import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getSession } from "@/lib/auth/session";
import { isPlatformOps } from "@/lib/auth/permissions";
import { PersonMergeForm } from "@/components/persons/person-merge-form";

export default async function PersonsMergePage() {
  const session = await getSession();
  if (!session) {
    redirect(`/${await getLocale()}/login`);
  }
  if (!isPlatformOps(session.user.permissions)) {
    notFound();
  }
  const t = await getTranslations("personsMerge");

  return (
    <div className="mx-auto max-w-3xl px-8 py-10 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t("intro")}</p>
      </header>

      <PersonMergeForm />
    </div>
  );
}
