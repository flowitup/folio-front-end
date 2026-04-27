import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
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

  return (
    <div className="container py-8 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Bulk Add Memberships
        </h1>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          Search for a user, select projects and a role, then submit.
        </p>
      </div>

      <BulkAddForm roles={roles} projects={projects} />
    </div>
  );
}
