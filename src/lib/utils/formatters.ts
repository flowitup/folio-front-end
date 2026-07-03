/**
 * Utility formatting functions
 */

/**
 * Format a number as currency (USD)
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

/**
 * Format a number as fr-FR EUR currency ("17 831,20 €").
 * Canonical money formatter for UI tables and totals — deterministic
 * across server and client (fixed locale, no browser dependence).
 */
export function formatEUR(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

/**
 * Format a date as dd/mm/YYYY (locale-independent).
 * Uses local (browser-timezone) calendar fields, matching prior
 * toLocaleDateString behavior, with manual zero-padding to avoid
 * Intl locale-ordering ambiguity.
 *
 * Date-only ISO strings (YYYY-MM-DD, e.g. invoice issue_date) are formatted
 * directly from their literal parts: parsing them via `new Date()` yields
 * UTC midnight, which `getDate()` then reads in local time and can shift the
 * day backwards in negative-UTC timezones. The fast-path keeps the day stable
 * everywhere while producing identical slash-separated output.
 */
export function formatDate(date: Date | string): string {
  if (typeof date === 'string') {
    const isoDateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
    if (isoDateOnly) {
      const [, yyyy, mm, dd] = isoDateOnly
      return `${dd}/${mm}/${yyyy}`
    }
  }
  const d = typeof date === 'string' ? new Date(date) : date
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

/**
 * Format a "YYYY-MM" or "YYYY-MM-DD" date string as a localized "Month Year"
 * label (e.g. "June 2026", "juin 2026"). Used for the labor invoice
 * "payment for month" field, which is stored as "YYYY-MM-01".
 *
 * Parses the year/month directly from the string (rather than via `new
 * Date()`) to avoid UTC/local timezone day-shift issues — see formatDate.
 * Returns the raw input unchanged if it doesn't match the expected shape.
 */
export function formatMonthYear(dateStr: string, locale: string): string {
  const match = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(dateStr)
  if (!match) return dateStr
  const [, yyyy, mm] = match
  // Construct as UTC noon to sidestep any residual timezone rollover.
  const d = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, 1, 12))
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d)
}

/**
 * Format a date and time as dd/mm/YYYY HH:MM (24h, locale-independent).
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${formatDate(d)} ${hh}:${min}`
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength - 3) + '...'
}

/**
 * Slugify a string for URLs
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Check if string is valid email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}
