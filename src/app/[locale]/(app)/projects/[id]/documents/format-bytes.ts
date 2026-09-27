/**
 * A file size in the app's language: "3.6 KB" in English, "3,6 Ko" in French.
 */
const UNITS: Record<string, [string, string, string, string]> = {
  fr: ["o", "Ko", "Mo", "Go"],
};
const DEFAULT_UNITS: [string, string, string, string] = ["B", "KB", "MB", "GB"];

export function formatBytes(n: number, locale: string): string {
  const [b, kb, mb, gb] = UNITS[locale] ?? DEFAULT_UNITS;
  const num = (value: number, digits: number) =>
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value);
  if (n < 1024) return `${num(n, 0)} ${b}`;
  if (n < 1024 * 1024) return `${num(n / 1024, 1)} ${kb}`;
  if (n < 1024 * 1024 * 1024) return `${num(n / (1024 * 1024), 1)} ${mb}`;
  return `${num(n / (1024 * 1024 * 1024), 2)} ${gb}`;
}
