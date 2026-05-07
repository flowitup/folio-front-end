/**
 * server-only stub for Vitest.
 *
 * The real `server-only` package throws at import time when used outside a
 * Next.js server context. Vitest runs in jsdom — stub it as a no-op so that
 * server-side API modules (lib/api/companies/*.ts, etc.) can be imported and
 * unit-tested with mocked fetch / sessionAuthHeader.
 *
 * Registered in vitest.config.ts → resolve.alias → 'server-only'.
 */

export {};
