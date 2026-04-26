import { describe, it, expect } from 'vitest'

describe('Test Framework Setup', () => {
  it('should verify Vitest is configured correctly', () => {
    expect(true).toBe(true)
  })

  it('should verify path aliases work', async () => {
    // Importing via the `@/` alias proves vitest's tsconfig path resolution
    // is wired up — more meaningful than checking cwd against a directory
    // name that breaks when the repo is renamed.
    const utils = await import('@/lib/utils')
    expect(typeof utils.cn).toBe('function')
  })
})
