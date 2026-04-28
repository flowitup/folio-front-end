"use client";

import { useTranslations } from "next-intl";
import { useAuth } from "@/context/AuthContext";
import { BulkAddForm } from "./bulk-add-form";
import type { Role } from "@/lib/api/roles";
import type { ProjectSummary } from "@/lib/api/projects-server";

interface Props {
  roles: Role[];
  projects: ProjectSummary[];
}

export function UsersSection({ roles, projects }: Props) {
  const t = useTranslations("settings.users");
  const { user } = useAuth();
  const isSuperadmin = (user?.permissions ?? []).includes("*:*");

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

  return <BulkAddForm roles={roles} projects={projects} />;
}
