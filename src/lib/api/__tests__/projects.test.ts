/**
 * Tests for project API functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchProjects, fetchProjectById } from '../projects'

// Mock the http module
vi.mock('../http', () => ({
  api: {
    get: vi.fn(),
  },
}))

import { api } from '../http'

const mockProjects = [
  {
    id: '1',
    name: 'Project A',
    address: '123 Main St',
    owner_id: 'owner1',
    user_count: 2,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: 'Project B',
    address: null,
    owner_id: 'owner1',
    user_count: 0,
    created_at: '2024-01-02T00:00:00Z',
  },
]

describe('fetchProjects', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns projects array on success', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      projects: mockProjects,
      total: 2,
    })

    const result = await fetchProjects()

    expect(api.get).toHaveBeenCalledWith('/projects')
    expect(result).toEqual(mockProjects)
    expect(result).toHaveLength(2)
  })

  it('returns empty array when no projects', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      projects: [],
      total: 0,
    })

    const result = await fetchProjects()

    expect(result).toEqual([])
    expect(result).toHaveLength(0)
  })

  it('throws error on API failure', async () => {
    const error = new Error('Network error')
    vi.mocked(api.get).mockRejectedValueOnce(error)

    await expect(fetchProjects()).rejects.toThrow('Network error')
  })

  it('throws error on 401 unauthorized', async () => {
    const error = new Error('HTTP 401: Unauthorized')
    vi.mocked(api.get).mockRejectedValueOnce(error)

    await expect(fetchProjects()).rejects.toThrow('HTTP 401: Unauthorized')
  })
})

describe('fetchProjectById', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns project on success', async () => {
    const mockProject = mockProjects[0]
    vi.mocked(api.get).mockResolvedValueOnce(mockProject)

    const result = await fetchProjectById('1')

    expect(api.get).toHaveBeenCalledWith('/projects/1')
    expect(result).toEqual(mockProject)
    expect(result.id).toBe('1')
    expect(result.name).toBe('Project A')
  })

  it('throws error on 404 not found', async () => {
    const error = new Error('HTTP 404: Not Found')
    vi.mocked(api.get).mockRejectedValueOnce(error)

    await expect(fetchProjectById('nonexistent')).rejects.toThrow(
      'HTTP 404: Not Found'
    )
  })

  it('throws error on 403 forbidden', async () => {
    const error = new Error('HTTP 403: Forbidden')
    vi.mocked(api.get).mockRejectedValueOnce(error)

    await expect(fetchProjectById('restricted')).rejects.toThrow(
      'HTTP 403: Forbidden'
    )
  })

  it('throws error on network failure', async () => {
    const error = new Error('Network error')
    vi.mocked(api.get).mockRejectedValueOnce(error)

    await expect(fetchProjectById('1')).rejects.toThrow('Network error')
  })
})
