/**
 * Tests for ProjectContext
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'

const mockProjects = [
  {
    id: '1',
    name: 'Project A',
    address: '123 St',
    owner_id: 'owner1',
    user_count: 2,
    created_at: '2024-01-01',
  },
  {
    id: '2',
    name: 'Project B',
    address: null,
    owner_id: 'owner1',
    user_count: 0,
    created_at: '2024-01-02',
  },
]

// Mock fetchProjects before importing the context
const mockFetchProjects = vi.fn()
vi.mock('@/lib/api/projects', () => ({
  fetchProjects: () => mockFetchProjects(),
}))

// Import after mock setup
import { ProjectProvider, useProject } from '../ProjectContext'

// Safe test component that handles context availability
// Note: Hooks must be called unconditionally - use the same pattern as TestConsumer
function SafeTestConsumer({ fallback = null }: { fallback?: ReactNode }) {
  const {
    projects,
    selectedProjectId,
    selectedProject,
    selectProject,
    isLoading,
    error,
  } = useProject()

  // The fallback prop is kept for API compatibility but not used
  // since we always render within ProjectProvider in tests
  void fallback

  return (
    <div>
      <span data-testid="loading">{isLoading ? 'loading' : 'loaded'}</span>
      <span data-testid="error">{error || 'no-error'}</span>
      <span data-testid="count">{projects.length}</span>
      <span data-testid="selected">{selectedProjectId || 'none'}</span>
      <span data-testid="selected-name">
        {selectedProject?.name || 'none'}
      </span>
      <button onClick={() => selectProject('2')}>Select Project B</button>
    </div>
  )
}

// Test component that always expects context
function TestConsumer() {
  const {
    projects,
    selectedProjectId,
    selectedProject,
    selectProject,
    isLoading,
    error,
  } = useProject()

  return (
    <div>
      <span data-testid="loading">{isLoading ? 'loading' : 'loaded'}</span>
      <span data-testid="error">{error || 'no-error'}</span>
      <span data-testid="count">{projects.length}</span>
      <span data-testid="selected">{selectedProjectId || 'none'}</span>
      <span data-testid="selected-name">{selectedProject?.name || 'none'}</span>
      <button onClick={() => selectProject('2')}>Select Project B</button>
    </div>
  )
}

// localStorage mock factory
function createLocalStorageMock(initialStore: Record<string, string> = {}) {
  const store: Record<string, string> = { ...initialStore }
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach((key) => delete store[key])
    }),
    get length() {
      return Object.keys(store).length
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  }
}

describe('ProjectContext', () => {
  let localStorageMock: ReturnType<typeof createLocalStorageMock>
  const originalLocalStorage = window.localStorage

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchProjects.mockResolvedValue(mockProjects)
    localStorageMock = createLocalStorageMock()
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    })
    vi.restoreAllMocks()
  })

  it('loads projects on mount', async () => {
    render(
      <ProjectProvider>
        <SafeTestConsumer />
      </ProjectProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
    })

    expect(screen.getByTestId('count')).toHaveTextContent('2')
    expect(mockFetchProjects).toHaveBeenCalledTimes(1)
  })

  it('auto-selects first project when none stored', async () => {
    render(
      <ProjectProvider>
        <SafeTestConsumer />
      </ProjectProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
    })

    await waitFor(() => {
      expect(screen.getByTestId('selected')).toHaveTextContent('1')
    })

    expect(screen.getByTestId('selected-name')).toHaveTextContent('Project A')
  })

  it('restores selection from localStorage', async () => {
    localStorageMock = createLocalStorageMock({ selectedProjectId: '2' })
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
      configurable: true,
    })

    render(
      <ProjectProvider>
        <SafeTestConsumer />
      </ProjectProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
    })

    await waitFor(() => {
      expect(screen.getByTestId('selected')).toHaveTextContent('2')
    })

    expect(screen.getByTestId('selected-name')).toHaveTextContent('Project B')
  })

  it('persists selection to localStorage', async () => {
    const user = userEvent.setup()

    render(
      <ProjectProvider>
        <SafeTestConsumer />
      </ProjectProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
    })

    await user.click(screen.getByText('Select Project B'))

    await waitFor(() => {
      expect(screen.getByTestId('selected')).toHaveTextContent('2')
    })

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'selectedProjectId',
      '2'
    )
  })

  it('handles fetch error gracefully', async () => {
    mockFetchProjects.mockRejectedValueOnce(new Error('Network error'))

    render(
      <ProjectProvider>
        <SafeTestConsumer />
      </ProjectProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Network error')
    })

    expect(screen.getByTestId('count')).toHaveTextContent('0')
  })

  it('falls back to first project if stored ID is invalid', async () => {
    localStorageMock = createLocalStorageMock({
      selectedProjectId: 'invalid-id',
    })
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
      configurable: true,
    })

    render(
      <ProjectProvider>
        <SafeTestConsumer />
      </ProjectProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
    })

    // Should fallback to first project since 'invalid-id' not found
    await waitFor(() => {
      expect(screen.getByTestId('selected')).toHaveTextContent('1')
    })
  })

  it('handles empty projects list', async () => {
    mockFetchProjects.mockResolvedValueOnce([])

    render(
      <ProjectProvider>
        <SafeTestConsumer />
      </ProjectProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
    })

    expect(screen.getByTestId('selected')).toHaveTextContent('none')
    expect(screen.getByTestId('count')).toHaveTextContent('0')
  })

  it('throws error when useProject used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<TestConsumer />)).toThrow(
      'useProject must be used within ProjectProvider'
    )

    consoleSpy.mockRestore()
  })

  it('renders children during hydration phase', async () => {
    render(
      <ProjectProvider>
        <SafeTestConsumer fallback={<span>hydrating</span>} />
      </ProjectProvider>
    )

    // After hydration completes, we should see the loaded state
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toBeInTheDocument()
    })
  })
})
