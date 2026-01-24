/**
 * Vitest global setup
 * Sets default environment variables for testing
 */

import '@testing-library/jest-dom/vitest'

// Set default environment variables for tests
process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:3001/api'
process.env.NEXT_PUBLIC_APP_ENV = 'test'
