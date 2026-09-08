import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getSession } from "@/lib/auth/session";
import { listMembers } from "@/lib/api/members";
import { listInvitations } from "@/lib/api/invitations";
import { getProjectById } from "@/lib/api/projects-server";
import { can, isCompanyAdmin, isPlatformOps } from "@/lib/auth/permissions";
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
  const [members, invites, project] = await Promise.all([
    listMembers(projectId).catch(() => []),
    listInvitations(projectId, "pending").catch(() => []),
    getProjectById(projectId).catch(() => null),
  ]);

  // Server-side permission check (authoritative). Invite + manage-members honor
  // the caller's EFFECTIVE per-project permissions (global role UNION the
  // resolver-computed my_permissions for this project — admin implicit rights,
  // assigned manager/member role, and any D8 grant/deny already folded in by
  // the backend). No owner_id bypass — the owner bypass was removed (D6):
  // the project creator is auto-assigned as manager and gets rights that way.
  const perms = session.user.permissions ?? [];
  const projectPerms = project?.my_permissions;
  const canInvite = can("project:invite", perms, projectPerms);
  const canManageMembers = can("project:manage_users", perms, projectPerms);
  // The assign flow calls PUT /projects/<id>/assignments/<userId>, which the
  // backend gates with require_project_access(write=True) — i.e. project:update,
  // not project:manage_users. Gate the button/dialog on the matching permission
  // so it never renders a control that would 403.
  const canAssignMembers = can("project:update", perms, projectPerms);
  // Manager is an admin-only role to hand out (assignments.ts: "admin may
  // assign any role; manager may only assign member") — derived from the
  // caller's per-company role, not a project permission.
  const callerIsCompanyAdmin = isCompanyAdmin(session.user.companies, project?.company_id ?? null, perms);
  // Editing identity (email / display name) is a GLOBAL concern (it changes how
  // the user signs in everywhere), so it stays gated on the caller's global
  // role only — never the per-project membership role.
  const canEditIdentity = perms.includes("user:update") || isPlatformOps(perms);

  return (
    <MembersTable
      projectId={projectId}
      companyId={project?.company_id ?? null}
      members={members}
      invites={invites}
      canInvite={canInvite}
      canManageMembers={canManageMembers}
      canAssignMembers={canAssignMembers}
      callerIsCompanyAdmin={callerIsCompanyAdmin}
      canEditIdentity={canEditIdentity}
      currentUserId={session.user.id}
    />
  );
}
