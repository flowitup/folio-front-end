/**
 * Folds a string for search: lower-case, accents removed (é → e, ợ → o), and the
 * Vietnamese đ/Đ (which has no Unicode decomposition) mapped to d. Lets "duong le loi"
 * find "Đường Lê Lợi" and "eloise" find "Éloïse".
 */
export function foldForSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase();
}

/** True when `haystack` contains `needle`, ignoring case and accents. An empty needle matches. */
export function searchIncludes(haystack: string | null | undefined, needle: string): boolean {
  const n = foldForSearch(needle.trim());
  if (!n) return true;
  return foldForSearch(haystack ?? "").includes(n);
}
