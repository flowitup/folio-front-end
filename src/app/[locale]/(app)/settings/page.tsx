import { getSession } from "@/lib/auth/session";
import { listProjects } from "@/lib/api/projects-server";
import { isPlatformOps } from "@/lib/auth/permissions";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  // Server-side permission gate: only fetch projects for platform-ops users.
  // Nobody else is offered the Users tab at all, so fetching for them would be
  // a pure BE round-trip regression vs the pre-relocation /admin/users
  // behavior (which redirected before fetching). UsersSection keeps its own
  // permission-denied panel as defense-in-depth — it is no longer a surface
  // the UI can route anyone to.
  const session = await getSession();
  const isSuperadmin = isPlatformOps(session?.user.permissions);

  const projects = isSuperadmin ? await listProjects().catch(() => []) : [];

  return <SettingsClient projects={projects} />;
}
