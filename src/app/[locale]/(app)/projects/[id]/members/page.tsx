import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getSession } from "@/lib/auth/session";
import { listMembers } from "@/lib/api/members";
import { listInvitations } from "@/lib/api/invitations";
import { listRoles } from "@/lib/api/roles";
import { getProjectById } from "@/lib/api/projects-server";
import { MembersTable } from "./members-table";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MembersPage({ params }: PageProps) {
  const { id: projectId } = await params;
  const locale = await getLocale();

  const session = await getSession();
  if (!session) {
    redirect(`/${locale}/login`);
  }

  // Parallel fetch — if members/invites fail (e.g. 403), fallback to empty arrays
  const [members, invites, roles, project] = await Promise.all([
    listMembers(projectId).catch(() => []),
    listInvitations(projectId, "pending").catch(() => []),
    listRoles().catch(() => []),
    getProjectById(projectId).catch(() => null),
  ]);

  // Server-side permission check (authoritative).
  // Invite allowed if: has explicit permission OR is project owner.
  const perms = session.user.permissions ?? [];
  const hasInvitePermission =
    perms.includes("project:invite") || perms.includes("*:*");
  const isProjectOwner = project?.owner_id === session.user.id;
  const canInvite = hasInvitePermission || isProjectOwner;

  return (
    <MembersTable
      projectId={projectId}
      members={members}
      invites={invites}
      roles={roles}
      canInvite={canInvite}
    />
  );
}
