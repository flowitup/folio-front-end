/**
 * Where switching to another project leads from the current page (path without
 * the locale prefix): the same section of the new project, e.g.
 * /projects/<new>/analyses. Only the first segment is kept — the rest names
 * entities of the old project (an analysis, an expense, "new" form) that do not
 * exist under the new one and would land on "Page not found". Null when the
 * page is not inside a project.
 */
export function projectSwitchPath(pathWithoutLocale: string, projectId: string): string | null {
  const section = pathWithoutLocale.match(/^\/projects\/[^/]+\/([^/?#]+)/)?.[1];
  return section ? `/projects/${projectId}/${section}` : null;
}
