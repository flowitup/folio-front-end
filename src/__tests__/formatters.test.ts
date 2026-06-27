import { describe, it, expect } from 'vitest'
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  truncate,
  slugify,
  isValidEmail,
} from '@/lib/utils/formatters'

describe('formatCurrency', () => {
  it('should format positive numbers', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56')
  })

  it('should format zero', () => {
    expect(formatCurrency(0)).toBe('$0.00')
  })

  it('should format negative numbers', () => {
    expect(formatCurrency(-500)).toBe('-$500.00')
  })

  it('should handle large numbers', () => {
    expect(formatCurrency(1000000)).toBe('$1,000,000.00')
  })
})

describe('formatDate', () => {
  it('should format Date object as dd/mm/YYYY', () => {
    // Construct via local fields to avoid timezone-dependent assertions.
    const date = new Date(2026, 0, 18, 12, 0, 0)
    expect(formatDate(date)).toBe('18/01/2026')
  })

  it('should zero-pad single-digit day and month', () => {
    const date = new Date(2026, 8, 5, 12, 0, 0)
    expect(formatDate(date)).toBe('05/09/2026')
  })

  it('should format a parseable date string', () => {
    expect(formatDate('2026-12-25T12:00:00')).toBe('25/12/2026')
  })

  it('should format a date-only ISO string without timezone shift', () => {
    // Backend issue_date/due_date are YYYY-MM-DD; the literal-parts fast-path
    // must keep the day stable regardless of the runtime timezone.
    expect(formatDate('2026-06-28')).toBe('28/06/2026')
    expect(formatDate('2026-01-05')).toBe('05/01/2026')
  })
})

describe('formatDateTime', () => {
  it('should format as dd/mm/YYYY HH:MM (24h)', () => {
    const date = new Date(2026, 0, 18, 14, 30, 0)
    expect(formatDateTime(date)).toBe('18/01/2026 14:30')
  })

  it('should zero-pad time components', () => {
    const date = new Date(2026, 0, 18, 9, 5, 0)
    expect(formatDateTime(date)).toBe('18/01/2026 09:05')
  })
})

describe('truncate', () => {
  it('should not truncate short strings', () => {
    expect(truncate('Hello', 10)).toBe('Hello')
  })

  it('should truncate long strings with ellipsis', () => {
    expect(truncate('Hello World', 8)).toBe('Hello...')
  })

  it('should handle exact length', () => {
    expect(truncate('Hello', 5)).toBe('Hello')
  })

  it('should handle empty string', () => {
    expect(truncate('', 10)).toBe('')
  })
})

describe('slugify', () => {
  it('should convert to lowercase', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  it('should replace spaces with hyphens', () => {
    expect(slugify('my blog post')).toBe('my-blog-post')
  })

  it('should remove special characters', () => {
    expect(slugify('Hello! World?')).toBe('hello-world')
  })

  it('should trim whitespace', () => {
    expect(slugify('  hello  ')).toBe('hello')
  })

  it('should handle multiple spaces', () => {
    expect(slugify('hello   world')).toBe('hello-world')
  })
})

describe('isValidEmail', () => {
  it('should validate correct email', () => {
    expect(isValidEmail('test@example.com')).toBe(true)
  })

  it('should validate email with subdomain', () => {
    expect(isValidEmail('user@mail.example.com')).toBe(true)
  })

  it('should reject email without @', () => {
    expect(isValidEmail('invalid.email')).toBe(false)
  })

  it('should reject email without domain', () => {
    expect(isValidEmail('test@')).toBe(false)
  })

  it('should reject email with spaces', () => {
    expect(isValidEmail('test @example.com')).toBe(false)
  })

  it('should reject empty string', () => {
    expect(isValidEmail('')).toBe(false)
  })
})
