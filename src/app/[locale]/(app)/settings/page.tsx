import { getSession } from "@/lib/auth/session";
import { listRoles } from "@/lib/api/roles";
import { listProjects } from "@/lib/api/projects-server";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  // Server-side permission gate: only fetch roles + projects for superadmin (*:*) users.
  // Non-superadmin viewers see the inline permission-denied panel in UsersSection without
  // needing this data — fetching for them was a +2 BE round-trip regression vs the pre-relocation
  // /admin/users behavior (which redirected before fetching). UsersSection still applies the
  // client-side gate for defense-in-depth.
  const session = await getSession();
  const isSuperadmin = session?.user.permissions.includes("*:*") ?? false;

  const [roles, projects] = isSuperadmin
    ? await Promise.all([
        listRoles().catch(() => []),
        listProjects().catch(() => []),
      ])
    : [[], []];

  return <SettingsClient roles={roles} projects={projects} />;
}
