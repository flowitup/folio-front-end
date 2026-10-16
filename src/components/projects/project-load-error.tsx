"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Shown by a project page whose project could not be loaded for a reason other
 * than "no access / no such project" (an outage, a timeout, a 5xx). The URL is
 * kept and the user can retry, instead of being bounced to the projects list
 * with no explanation.
 */
export function ProjectLoadError() {
  const t = useTranslations("projects");
  const router = useRouter();
  return (
    <div className="px-4 pb-12 pt-2 lg:px-8" data-testid="project-load-error">
      <div
        className="folio-card flex flex-col items-center gap-3 px-6 py-10 text-center"
        role="alert"
      >
        <p className="text-[14px]">{t("projectLoadError")}</p>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => router.refresh()}>
          <RotateCw aria-hidden="true" size={14} />
          {t("retry")}
        </Button>
      </div>
    </div>
  );
}
