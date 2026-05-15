/**
 * Localize built-in payment method labels.
 *
 * Built-in methods are seeded with the English literal "Cash" + the company's
 * legal_name. We translate "Cash" to the user's locale; company names are
 * proper nouns and rendered as-is.
 *
 * The lookup is case-insensitive on the canonical English seed value so that
 * users who manually rename "Cash" to e.g. "cash" (or with whitespace) still
 * get the translation. Custom user-defined methods are returned unchanged.
 *
 * Usage:
 *   const t = useTranslations("paymentMethods.builtins");
 *   <span>{localizeMethodLabel(method.label, t)}</span>
 *
 * For invoice snapshots (where we only have the string, not is_builtin), we
 * still match on the literal "Cash" — false positives only happen if a user
 * deliberately created a custom method named "Cash", which is misuse.
 */

type Translator = (key: string) => string;

const BUILTIN_LABEL_KEYS: Record<string, string> = {
  cash: "cash",
};

export function localizeMethodLabel(
  label: string | null | undefined,
  t: Translator,
): string {
  if (!label) return "";
  const key = BUILTIN_LABEL_KEYS[label.trim().toLowerCase()];
  if (!key) return label;
  // The translator is scoped to "paymentMethods.builtins"; key is "cash".
  return t(key);
}
