import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('Environment Config', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('getEnvVar behavior', () => {
    it('should throw when required env var is missing', async () => {
      delete process.env.NEXT_PUBLIC_API_BASE_URL

      await expect(import('@/lib/config/env')).rejects.toThrow(
        'Missing required environment variable: NEXT_PUBLIC_API_BASE_URL'
      )
    })

    it('should read NEXT_PUBLIC_API_BASE_URL when set', async () => {
      process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.test.com'

      const { env } = await import('@/lib/config/env')
      expect(env.apiBaseUrl).toBe('https://api.test.com')
    })
  })

  describe('isDevelopment', () => {
    it('should return true when NODE_ENV is development', async () => {
      ;(process.env as Record<string, string>).NODE_ENV = 'development'
      process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:8000'

      const { isDevelopment } = await import('@/lib/config/env')
      expect(isDevelopment).toBe(true)
    })

    it('should return false when NODE_ENV is production', async () => {
      ;(process.env as Record<string, string>).NODE_ENV = 'production'
      process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.example.com'

      const { isDevelopment } = await import('@/lib/config/env')
      expect(isDevelopment).toBe(false)
    })
  })

  describe('isProduction', () => {
    it('should return true when NODE_ENV is production', async () => {
      ;(process.env as Record<string, string>).NODE_ENV = 'production'
      process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.example.com'

      const { isProduction } = await import('@/lib/config/env')
      expect(isProduction).toBe(true)
    })

    it('should return false when NODE_ENV is development', async () => {
      ;(process.env as Record<string, string>).NODE_ENV = 'development'
      process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:8000'

      const { isProduction } = await import('@/lib/config/env')
      expect(isProduction).toBe(false)
    })
  })
})
