import { foldForSearch } from "@/lib/utils/fold-for-search";

/**
 * How a project is named everywhere in the UI (cards, switchers, dialogs,
 * pickers, the bell, chat and documents): its NAME first, its site address
 * second. A project created without a name is named after its address by the
 * API, so the name is never blank in practice; the address is only the fallback
 * for a blank name, so nothing ever renders empty.
 */
export function projectDisplayName(project: {
  name: string;
  address?: string | null;
}): string {
  const name = project.name?.trim();
  if (name) return name;
  return project.address?.trim() ?? "";
}

/**
 * The second line under a project's name: its site address, or null when the
 * address is missing or already is the name (a project created without a name).
 */
export function projectSecondaryLabel(project: {
  name: string;
  address?: string | null;
}): string | null {
  const address = project.address?.trim();
  if (!address) return null;
  return address === projectDisplayName(project) ? null : address;
}

/** Accent- and case-insensitive match of a search string against the name OR the address. */
export function projectMatchesSearch(
  project: { name: string; address?: string | null },
  search: string,
): boolean {
  const needle = foldForSearch(search.trim());
  if (!needle) return true;
  return (
    foldForSearch(project.name ?? "").includes(needle) ||
    foldForSearch(project.address ?? "").includes(needle)
  );
}
