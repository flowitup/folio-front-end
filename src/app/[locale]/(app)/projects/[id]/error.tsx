"use client";

/**
 * Error boundary of a project's pages: an outage (network, 5xx) while loading
 * a project page shows a translated error with a retry inside the app shell,
 * instead of bouncing the user to the projects list. A real "no access" case
 * (403/404) is the not-found page (see layout.tsx and lib/api/project-access).
 */

import { startTransition } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export default function ProjectError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("errors.boundary");
  const router = useRouter();

  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-6 py-20 text-center">
      <AlertCircle className="size-10 text-muted-foreground/40" aria-hidden />
      <p className="font-medium">{t("title")}</p>
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          startTransition(() => {
            router.refresh();
            reset();
          })
        }
      >
        {t("retry")}
      </Button>
    </div>
  );
}
