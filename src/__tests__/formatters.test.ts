import { describe, it, expect } from 'vitest'
import {
  formatCurrency,
  formatDate,
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
  it('should format Date object', () => {
    const date = new Date('2026-01-18T12:00:00Z')
    expect(formatDate(date)).toBe('Jan 18, 2026')
  })

  it('should format ISO string', () => {
    expect(formatDate('2026-12-25T12:00:00Z')).toBe('Dec 25, 2026')
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
