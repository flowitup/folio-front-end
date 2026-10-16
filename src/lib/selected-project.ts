/** The key ProjectContext keeps the selected project under (see src/context/ProjectContext.tsx). */
export const SELECTED_PROJECT_STORAGE_KEY = "selectedProjectId";

/**
 * Select a project before a full navigation, so the next page opens on it
 * rather than on the project viewed last (e.g. the one just joined).
 */
export function rememberSelectedProject(projectId: string | undefined): void {
  if (!projectId) return;
  try {
    localStorage.setItem(SELECTED_PROJECT_STORAGE_KEY, projectId);
  } catch {
    // Storage blocked (private mode): the dashboard falls back to its default project.
  }
}
