import { getSession } from "@/lib/auth/session";
import { listRoles } from "@/lib/api/roles";
import { listProjects } from "@/lib/api/projects-server";
import { isPlatformOps } from "@/lib/auth/permissions";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  // Server-side permission gate: only fetch roles + projects for platform-ops
  // users. Non-ops viewers see the inline permission-denied panel in
  // UsersSection without needing this data — fetching for them was a +2 BE
  // round-trip regression vs the pre-relocation /admin/users behavior (which
  // redirected before fetching). UsersSection still applies the client-side
  // gate for defense-in-depth.
  const session = await getSession();
  const isSuperadmin = isPlatformOps(session?.user.permissions);

  const [roles, projects] = await Promise.all([
    isSuperadmin ? listRoles().catch(() => []) : Promise.resolve([]),
    isSuperadmin ? listProjects().catch(() => []) : Promise.resolve([]),
  ]);

  return <SettingsClient roles={roles} projects={projects} />;
}
