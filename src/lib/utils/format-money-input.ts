/**
 * An amount as the text a money field starts with, in the reader's decimal
 * separator ("1 234 567,89" in French and Vietnamese, "1 234 567.89" in
 * English), never the raw "1234567.89". Thousands are grouped with a narrow
 * space in every locale: "150,000" or "150.000" would be ambiguous to
 * parseMoneyInput, which reads it back. No currency sign: the field shows €.
 */
export function formatMoneyInput(amount: number, locale: string): string {
  const whole = Math.round(amount * 100) % 100 === 0;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })
    .formatToParts(amount)
    .map((part) => (part.type === "group" ? " " : part.value))
    .join("");
}
