"use client";

import { useTranslations } from "next-intl";
import { useAuth } from "@/context/AuthContext";
import { isPlatformOps } from "@/lib/auth/permissions";
import { BulkAddForm } from "./bulk-add-form";
import type { ProjectSummary } from "@/lib/api/projects-server";

interface Props {
  projects: ProjectSummary[];
}

export function UsersSection({ projects }: Props) {
  const t = useTranslations("settings.users");
  const { user } = useAuth();
  const isSuperadmin = isPlatformOps(user?.permissions);

  if (!isSuperadmin) {
    return (
      <div
        className="rounded-lg border p-6"
        style={{ borderColor: "var(--border)" }}
      >
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p
          className="mt-2 text-sm"
          style={{ color: "var(--muted-foreground)" }}
          role="alert"
        >
          {t("permissionDenied")}
        </p>
      </div>
    );
  }

  return <BulkAddForm projects={projects} />;
}
