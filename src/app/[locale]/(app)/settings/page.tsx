import { listRoles } from "@/lib/api/roles";
import { listProjects } from "@/lib/api/projects-server";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  // Parallel fetch — fallback to empty arrays so page still renders on auth/network errors.
  // UsersSection applies the *:* permission gate client-side (inline panel for non-superadmins).
  const [roles, projects] = await Promise.all([
    listRoles().catch(() => []),
    listProjects().catch(() => []),
  ]);

  return <SettingsClient roles={roles} projects={projects} />;
}
