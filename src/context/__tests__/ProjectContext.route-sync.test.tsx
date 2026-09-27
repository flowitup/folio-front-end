/**
 * The project in a /projects/<id>/... URL must drive the selected project, so a
 * deep link opened while another project is stored never shows or acts on the
 * stored one.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const mockProjects = [
  { id: 'aaa', name: 'Project A', address: null, owner_id: 'o', user_count: 1, created_at: '2024-01-01' },
  { id: 'bbb', name: 'Project B', address: null, owner_id: 'o', user_count: 1, created_at: '2024-01-02' },
]

const mockFetchProjects = vi.fn()
const mockFetchProjectById = vi.fn()
vi.mock('@/lib/api/projects', () => ({
  fetchProjects: () => mockFetchProjects(),
  fetchProjectById: (id: string) => mockFetchProjectById(id),
}))

let mockPathname = '/en/dashboard'
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}))

import { ProjectProvider, projectIdFromPath, useProject } from '../ProjectContext'

function Consumer() {
  const { projects, selectedProjectId, selectedProject, isLoading } = useProject()
  return (
    <div>
      <span data-testid="count">{projects.length}</span>
      <span data-testid="loading">{isLoading ? 'loading' : 'loaded'}</span>
      <span data-testid="selected">{selectedProjectId ?? 'none'}</span>
      <span data-testid="selected-name">{selectedProject?.name ?? 'none'}</span>
    </div>
  )
}

describe('ProjectContext route sync', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('selectedProjectId', 'aaa')
    mockFetchProjects.mockResolvedValue(mockProjects)
    mockFetchProjectById.mockRejectedValue(new Error('403'))
  })

  afterEach(() => {
    mockPathname = '/en/dashboard'
    vi.clearAllMocks()
  })

  it('selects the project named in the URL over the stored one and persists it', async () => {
    mockPathname = '/en/projects/bbb/planning'
    render(
      <ProjectProvider>
        <Consumer />
      </ProjectProvider>
    )

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('loaded'))
    expect(screen.getByTestId('selected')).toHaveTextContent('bbb')
    expect(screen.getByTestId('selected-name')).toHaveTextContent('Project B')
    await waitFor(() => expect(localStorage.getItem('selectedProjectId')).toBe('bbb'))
  })

  it('keeps the stored project on routes that name no project', async () => {
    mockPathname = '/en/dashboard'
    render(
      <ProjectProvider>
        <Consumer />
      </ProjectProvider>
    )

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('loaded'))
    expect(screen.getByTestId('selected')).toHaveTextContent('aaa')
  })

  it('ignores a URL project id the user cannot see', async () => {
    mockPathname = '/en/projects/zzz/labor'
    render(
      <ProjectProvider>
        <Consumer />
      </ProjectProvider>
    )

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('loaded'))
    await waitFor(() => expect(mockFetchProjectById).toHaveBeenCalledWith('zzz'))
    expect(screen.getByTestId('selected')).toHaveTextContent('aaa')
    expect(localStorage.getItem('selectedProjectId')).toBe('aaa')
  })

  it('loads the URL project on its own when the project list fails, in a fresh browser', async () => {
    localStorage.clear()
    mockPathname = '/fr/projects/bbb/labor'
    mockFetchProjects.mockRejectedValue(new Error('list unavailable'))
    mockFetchProjectById.mockResolvedValue(mockProjects[1])
    render(
      <ProjectProvider>
        <Consumer />
      </ProjectProvider>
    )

    await waitFor(() => expect(screen.getByTestId('selected')).toHaveTextContent('bbb'))
    expect(screen.getByTestId('selected-name')).toHaveTextContent('Project B')
    expect(screen.getByTestId('count')).toHaveTextContent('1')
  })

  it('selects the URL project on first load in a fresh browser', async () => {
    localStorage.clear()
    mockPathname = '/fr/projects/bbb/documents'
    render(
      <ProjectProvider>
        <Consumer />
      </ProjectProvider>
    )

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('loaded'))
    expect(screen.getByTestId('selected')).toHaveTextContent('bbb')
    await waitFor(() => expect(localStorage.getItem('selectedProjectId')).toBe('bbb'))
  })
})

describe('projectIdFromPath', () => {
  it.each([
    ['/en/projects/bbb/planning', 'bbb'],
    ['/projects/bbb/invoices/new', 'bbb'],
    ['/fr/projects/bbb/labor', 'bbb'],
    ['/en/projects', null],
    ['/en/dashboard', null],
    [null, null],
  ])('%s -> %s', (path, expected) => {
    expect(projectIdFromPath(path)).toBe(expected)
  })
})
