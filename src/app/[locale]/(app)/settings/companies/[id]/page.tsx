/**
 * Admin company manage page — server component.
 *
 * Permission gate: redirects to /settings if the caller is not an admin (*:*).
 * Fetches company detail + attached users server-side; passes to the client
 * AdminCompanyManagePage component.
 */

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { fetchCompany, fetchAttachedUsers } from "@/lib/api/companies";
import { AdminCompanyManagePage } from "@/components/companies/admin-company-manage-page";

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export default async function CompanyManagePage({ params }: Props) {
  const { locale, id } = await params;

  // Permission gate — non-admins see /settings
  const session = await getSession();
  const isAdmin = session?.user.permissions.includes("*:*") ?? false;
  if (!isAdmin) {
    redirect(`/${locale}/settings`);
  }

  // Fetch data — gracefully handle not-found by redirecting
  let company;
  let attachedUsers;
  try {
    [company, attachedUsers] = await Promise.all([
      fetchCompany(id),
      fetchAttachedUsers(id),
    ]);
  } catch {
    redirect(`/${locale}/settings`);
  }

  return (
    <div className="fade-up px-8 pb-12 pt-6 max-w-4xl mx-auto">
      {/* Back link */}
      <a
        href={`/${locale}/settings`}
        className="mb-6 inline-flex items-center gap-1.5 text-[13px] hover:underline"
        style={{ color: "var(--muted)" }}
      >
        ← Back to Settings
      </a>

      <AdminCompanyManagePage company={company} initialUsers={attachedUsers} />
    </div>
  );
}
