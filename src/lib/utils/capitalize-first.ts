/**
 * Uppercase only the first character of a string, locale-aware.
 *
 * Use case: French-locale date strings via Intl.DateTimeFormat return
 * lowercase day names (e.g. "samedi 09/05/2026"). Wrap the formatted
 * output to render "Samedi 09/05/2026". Apply ONLY where the day-name /
 * leading token should be capitalized — never inside a sentence, since
 * this would also clobber legitimate lowercase leading words.
 *
 * Empty / non-letter first chars are returned unchanged.
 */
export function capitalizeFirst(str: string, locale?: string): string {
  if (!str) return str;
  const first = str.charAt(0);
  const upper = locale ? first.toLocaleUpperCase(locale) : first.toUpperCase();
  return upper + str.slice(1);
}
