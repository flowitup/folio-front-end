/**
 * Business dates the API accepts (back end: app/api/v1/date_bounds.py).
 * An expense date outside these years is a typo ("0026" for "2026"); the API
 * refuses it, so a form can say so first and its date picker can stop there.
 */

export const MIN_BUSINESS_DATE = "2000-01-01";
export const MAX_BUSINESS_DATE = "2100-12-31";
/** The same bounds for a native month input ("YYYY-MM"). */
export const MIN_BUSINESS_MONTH = MIN_BUSINESS_DATE.slice(0, 7);
export const MAX_BUSINESS_MONTH = MAX_BUSINESS_DATE.slice(0, 7);
/** First and last accepted years, for messages. */
export const MIN_BUSINESS_YEAR = Number(MIN_BUSINESS_DATE.slice(0, 4));
export const MAX_BUSINESS_YEAR = Number(MAX_BUSINESS_DATE.slice(0, 4));

/** True for a "YYYY-MM-DD" day (or "YYYY-MM" month) inside the accepted years. */
export function isBusinessDate(value: string): boolean {
  // Four-digit years only: a native input lets "20000-01-01" through, which
  // compares as text between the bounds.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value >= MIN_BUSINESS_DATE && value <= MAX_BUSINESS_DATE;
  }
  if (/^\d{4}-\d{2}$/.test(value)) {
    return value >= MIN_BUSINESS_MONTH && value <= MAX_BUSINESS_MONTH;
  }
  return false;
}
