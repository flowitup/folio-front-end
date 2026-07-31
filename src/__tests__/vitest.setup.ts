/**
 * Vitest global setup
 * Sets default environment variables for testing
 */

import '@testing-library/jest-dom/vitest'

// Set default environment variables for tests
process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:3001/api'
process.env.NEXT_PUBLIC_APP_ENV = 'test'

// ResizeObserver polyfill — required by cmdk (not available in jsdom)
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// Mock pointer capture methods for Radix UI components (not supported in jsdom)
Element.prototype.hasPointerCapture = () => false
Element.prototype.setPointerCapture = () => {}
Element.prototype.releasePointerCapture = () => {}

// Mock scrollIntoView (not supported in jsdom)
Element.prototype.scrollIntoView = () => {}

// Default matchMedia stub (jsdom has none) — reports "no match" so components
// gating on viewport queries (e.g. desktop-only drawers) default safely.
// Tests that need a specific match/change behavior override window.matchMedia
// locally.
if (typeof window.matchMedia === 'undefined') {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}

// Global localStorage mock (ensures localStorage is always available in tests)
const localStorageStore: Record<string, string> = {}
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: (key: string) => localStorageStore[key] ?? null,
    setItem: (key: string, value: string) => {
      localStorageStore[key] = value
    },
    removeItem: (key: string) => {
      delete localStorageStore[key]
    },
    clear: () => {
      Object.keys(localStorageStore).forEach((key) => delete localStorageStore[key])
    },
    get length() {
      return Object.keys(localStorageStore).length
    },
    key: (index: number) => Object.keys(localStorageStore)[index] ?? null,
  },
  writable: true,
  configurable: true,
})

