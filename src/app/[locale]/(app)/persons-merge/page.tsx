/**
 * /persons-merge — admin tool to consolidate duplicate Person rows.
 *
 * Hosts <PersonMergeForm>. Backed by POST /api/v1/persons/<id>/merge, which
 * only platform ops may call: anyone else gets a 404 here instead of a form
 * that fails with "Platform ops required." at the last step.
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
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-6 sm:px-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t("description")}</p>
      </header>

      <PersonMergeForm />
    </div>
  );
}
