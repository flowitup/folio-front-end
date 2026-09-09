/**
 * Label shown wherever a project is identified to the user (cards, switchers,
 * dialogs, pickers). Projects are presented by their site address; the stored
 * `name` is only the fallback for projects that have no address yet, so nothing
 * ever renders blank.
 */
export function projectDisplayName(project: {
  name: string;
  address?: string | null;
}): string {
  const address = project.address?.trim();
  return address ? address : project.name;
}

/** Case-insensitive match of a search string against the address OR the name. */
export function projectMatchesSearch(
  project: { name: string; address?: string | null },
  search: string,
): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return (
    project.name.toLowerCase().includes(needle) ||
    (project.address ?? "").toLowerCase().includes(needle)
  );
}
