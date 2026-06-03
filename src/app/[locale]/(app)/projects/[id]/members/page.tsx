import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getSession } from "@/lib/auth/session";
import { listMembers } from "@/lib/api/members";
import { listInvitations } from "@/lib/api/invitations";
import { listRoles } from "@/lib/api/roles";
import { getProjectById } from "@/lib/api/projects-server";
import { canOnProject } from "@/lib/auth/project-permissions";
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

  // Server-side permission check (authoritative). Invite + manage-members honor
  // the caller's EFFECTIVE per-project permissions (global role UNION their
  // membership-role perms on this project), so a project manager/admin can
  // invite and manage members even when their global role is the read-only
  // default. Mirrors the backend gates.
  const perms = session.user.permissions ?? [];
  const projectPerms = project?.my_permissions;
  const isProjectOwner = project?.owner_id === session.user.id;
  const canInvite = canOnProject("project:invite", perms, projectPerms) || isProjectOwner;
  const canManageMembers = canOnProject("project:manage_users", perms, projectPerms) || isProjectOwner;
  // Editing identity (email / display name) is a GLOBAL concern (it changes how
  // the user signs in everywhere), so it stays gated on the caller's global
  // role only — never the per-project membership role.
  const canEditIdentity = perms.includes("user:update") || perms.includes("*:*");

  return (
    <MembersTable
      projectId={projectId}
      members={members}
      invites={invites}
      roles={roles}
      canInvite={canInvite}
      canManageMembers={canManageMembers}
      canEditIdentity={canEditIdentity}
      currentUserId={session.user.id}
    />
  );
}
