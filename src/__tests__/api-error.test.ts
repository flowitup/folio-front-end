import { describe, it, expect } from 'vitest'
import { ApiError } from '@/lib/api/http'

describe('ApiError', () => {
  it('should create error with message and status', () => {
    const error = new ApiError('Not Found', 404)

    expect(error.message).toBe('Not Found')
    expect(error.status).toBe(404)
    expect(error.name).toBe('ApiError')
    expect(error.data).toBeUndefined()
  })

  it('should create error with additional data', () => {
    const errorData = { field: 'email', reason: 'invalid' }
    const error = new ApiError('Validation Error', 400, errorData)

    expect(error.status).toBe(400)
    expect(error.data).toEqual(errorData)
  })

  it('should be instanceof Error', () => {
    const error = new ApiError('Server Error', 500)

    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(ApiError)
  })

  it('should have correct error name for stack traces', () => {
    const error = new ApiError('Unauthorized', 401)

    expect(error.name).toBe('ApiError')
    expect(error.stack).toContain('ApiError')
  })

  it('should preserve message in stack trace', () => {
    const error = new ApiError('Custom Error Message', 503)

    expect(error.stack).toBeDefined()
    expect(error.message).toBe('Custom Error Message')
  })
})
