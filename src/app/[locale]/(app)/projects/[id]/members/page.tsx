import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getSession } from "@/lib/auth/session";
import { listMembers } from "@/lib/api/members";
import { listInvitations } from "@/lib/api/invitations";
import { getProjectById } from "@/lib/api/projects-server";
import { can, isCompanyAdmin, isPlatformOps } from "@/lib/auth/permissions";
import { MembersTable } from "./members-table";
import { pageTitle } from "@/lib/i18n/page-title";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const generateMetadata = pageTitle("members.title");

export default async function MembersPage({ params }: PageProps) {
  const { id: projectId } = await params;
  const locale = await getLocale();

  const session = await getSession();
  if (!session) {
    redirect(`/${locale}/login`);
  }

  // The project decides everything below: a foreign, unassigned or invalid id
  // must not fall back to the caller's company-wide permissions and draw an
  // empty page with live Invite and Assign buttons.
  const project = await getProjectById(projectId).catch(() => null);
  if (!project) {
    redirect(`/${locale}/projects`);
  }

  // Server-side permission check (authoritative). Invite + manage-members honor
  // the caller's EFFECTIVE per-project permissions (global role UNION the
  // resolver-computed my_permissions for this project — admin implicit rights,
  // assigned manager/member role, and any D8 grant/deny already folded in by
  // the backend). No owner_id bypass — the owner bypass was removed (D6):
  // the project creator is auto-assigned as manager and gets rights that way.
  const perms = session.user.permissions ?? [];
  const projectPerms = project.my_permissions;
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
  const callerIsCompanyAdmin = isCompanyAdmin(session.user.companies, project.company_id ?? null, perms);
  // Editing identity (email / display name) is a GLOBAL concern (it changes how
  // the user signs in everywhere): the backend lets platform ops only, and no
  // role carries a "user:update" permission.
  const canEditIdentity = isPlatformOps(perms);

  // Pending invitations are for those who may invite (the API answers 403 to
  // anyone else) — a read-only member gets no invitations section at all.
  const [members, invites] = await Promise.all([
    listMembers(projectId).catch(() => []),
    canInvite ? listInvitations(projectId, "pending").catch(() => []) : Promise.resolve([]),
  ]);

  return (
    <MembersTable
      projectId={projectId}
      companyId={project.company_id ?? null}
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
