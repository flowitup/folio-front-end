"use client";

/**
 * Hides a project section its company turned off (Settings › Company › Hidden
 * sections) when it is opened by URL; the navigation no longer links to it.
 */

import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { EyeOff } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { projectRouteSection } from "@/lib/companies/hidden-sections";

interface ProjectSectionGuardProps {
  projectId: string;
  /** Sections the project's company hides. */
  hiddenSections: string[];
  children: React.ReactNode;
}

export function ProjectSectionGuard({
  projectId,
  hiddenSections,
  children,
}: ProjectSectionGuardProps) {
  const pathname = usePathname() ?? "";
  const locale = useLocale();
  const t = useTranslations("projects.hiddenSection");
  const path = pathname.replace(new RegExp(`^/${locale}(?=/|$)`), "") || "/";
  const section = hiddenSections.length > 0 ? projectRouteSection(path) : null;

  if (!section || !hiddenSections.includes(section)) return <>{children}</>;

  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center" data-testid="project-section-hidden">
      <EyeOff size={28} className="mx-auto mb-4" style={{ color: "var(--muted)" }} aria-hidden />
      <h2 className="font-display text-[20px] font-medium tracking-tight">{t("title")}</h2>
      <p className="mt-2 text-[14px]" style={{ color: "var(--muted)" }}>
        {t("body")}
      </p>
      <Link
        prefetch={false}
        href={`/projects/${projectId}`}
        className="mt-6 inline-block text-[14px] font-medium underline underline-offset-4"
      >
        {t("back")}
      </Link>
    </div>
  );
}
