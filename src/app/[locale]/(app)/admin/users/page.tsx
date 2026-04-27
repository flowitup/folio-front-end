import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ShieldCheck } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { listRoles } from "@/lib/api/roles";
import { listProjects } from "@/lib/api/projects-server";
import { BulkAddForm } from "./bulk-add-form";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminUsersPage({ params }: PageProps) {
  // Await params per Next.js 15 dynamic API requirement
  await params;
  const locale = await getLocale();

  const session = await getSession();
  if (!session) {
    redirect(`/${locale}/login`);
  }

  // Authoritative superadmin check — *:* permission required
  if (!session.user.permissions.includes("*:*")) {
    redirect(`/${locale}/unauthorized`);
  }

  // Parallel fetch — fallback to empty arrays so page still renders
  const [roles, projects] = await Promise.all([
    listRoles().catch(() => []),
    listProjects().catch(() => []),
  ]);

  const t = await getTranslations("admin.bulkAdd");
  const tNav = await getTranslations("navigation.admin");

  return (
    <div className="fade-up space-y-8 px-8 pb-12">
      {/* Page header — matches Folio's quietly-confident page-title aesthetic */}
      <div className="space-y-2 pt-2">
        <div
          className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: "var(--accent)" }}
        >
          <ShieldCheck aria-hidden="true" size={13} />
          <span>{tNav("section")}</span>
          <span style={{ color: "var(--muted)" }}>›</span>
          <span style={{ color: "var(--muted)" }}>{tNav("users")}</span>
        </div>
        <h1 className="font-display text-[28px] font-semibold tracking-tight">
          {t("title")}
        </h1>
        <p className="text-sm max-w-2xl" style={{ color: "var(--muted)" }}>
          {t("subtitle")}
        </p>
      </div>

      {/* Form */}
      <BulkAddForm roles={roles} projects={projects} />
    </div>
  );
}
